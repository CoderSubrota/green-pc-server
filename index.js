require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 4030;
//middleware
app.use(cors());
app.use(express.json());
//verify jwt token
const verifyJWT = (req, res, next) => {
   const getToken = req.headers.authorization;
   if (!getToken) {
      return res.status(401).send({ message: "unauthorize access" });
   }
   const token = getToken.split(" ")[1];
   jwt.verify(token, process.env.SECRET_TOKEN, (error, decoded) => {
      if (error) {
         return res.status(403).send({ message: "Forbidden access" });
      }
      req.decoded = decoded;
      next();
   })
}

app.get("/", (req, res) => {
   res.send("Welcome my dear friends this is home page of green pc shop !! ");
})

const runMongoDB = async () => {
   try {
      //get connection with mongoDB 
 
      const uri = process.env.MONGODB_URL;
      const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
      //collections 
      const usersCollection = client.db("green-computers").collection("users");
      const categoriesCollection = client.db("green-computers").collection("categories");
      const productsCollection = client.db("green-computers").collection("products");
      const ordersCollection = client.db("green-computers").collection("orders");
      //verify seller 
      const verifySeller = async (req, res, next) => {
         const decodedEmail = req.decoded.email;
         const filter = { email: decodedEmail };
         const checkSellerAccount = await usersCollection.findOne(filter);
         if (checkSellerAccount?.role !== "Seller") {
            return res.status(403).send({ message: "Forbidden access" });
         }
         next();
      }
      //verify admin
      const verifyAdmin = async (req, res, next) => {
         const decodedEmail = req.decoded.email;
         const filter = { email: decodedEmail };
         const checkSellerAccount = await usersCollection.findOne(filter);
         if (checkSellerAccount?.role !== "Admin") {
            return res.status(403).send({ message: "Forbidden access" });
         }
         next();
      }
      //verify buyer
      const verifyBuyer = async (req, res, next) => {
         const decodedEmail = req.decoded.email;
         const filter = { email: decodedEmail };
         const checkSellerAccount = await usersCollection.findOne(filter);
         if (checkSellerAccount?.role !== "Buyer") {
            return res.status(403).send({ message: "Forbidden access" });
         }
         next();
      }

      //save user data 
      app.post("/users", async (req, res) => {
         const userInformation = req.body;
         const query = { email: req.body.email };
         const alreadyExist = await usersCollection.findOne(query);
         if (alreadyExist) {
            res.status(401).send({ existed: "Already have an account of yours in our collection 👋 👋 " });
            return;
         }
         const result = await usersCollection.insertOne(userInformation);
         res.status(201).send(result);
      }) 

      //save categories data
      app.post("/categories", verifyJWT, verifySeller, async (req, res) => {
         const categoryData = req.body;
         let productCategory = req.body.productCategory;
         productCategory.toLocaleLowerCase();
         const query = { productCategory: productCategory }
         const categoryExist = await categoriesCollection.findOne(query);
         if (categoryExist) {
            return res.status(400).send({ categoryExisted: "Already this category existed try another !! " });
         } 
         const result = await categoriesCollection.insertOne(categoryData);
         res.status(201).send(result);
      });

      //get the all categories
      app.get('/categories',  async (req, res) => {
         const result = await categoriesCollection.find().sort({ _id: - 1 }).toArray();
         res.status(201).send(result);
      })
      //check seller account 
      app.get("/users/sellers/:email", async (req, res) => {
         const email = req.params.email;
         const filter = { email: email };
         const checkSellerAccount = await usersCollection.findOne(filter);
         res.status(201).send({ isSeller: checkSellerAccount.role === "Seller" });
      })
          //check buyers account 
          app.get("/users/buyers/:email", async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const checkBuyerAccount = await usersCollection.findOne(filter);
            res.status(201).send({ isBuyer: checkBuyerAccount?.role === "Buyer" });
         })
          //check admin account 
          app.get("/users/admin/:email", async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const checkBuyerAccount = await usersCollection.findOne(filter);
            res.status(201).send({ isAdmin: checkBuyerAccount?.role === "Admin" });
         })

      //get specific user to get his data 
      app.get("/users/:email", async (req, res) => {
         const email = req.params?.email;
         const filter = { email: email };
         const result = await usersCollection.findOne(filter);
         res.status(201).send(result);
      })
      //>>--------------->> Products start from here <<--------------<<
   
      //add new product
      app.post("/products", verifyJWT, verifySeller, async (req, res) => {
         const productsData = req.body;
         const result = await productsCollection.insertOne(productsData);
         res.status(201).send(result);
      })
      //get product data by user email
      app.get("/products/:email", verifyJWT, verifySeller, async (req, res) => {
         const decodedEmail = req.decoded.email;
         const email = req.params.email;
         if (decodedEmail !== email) {
            return res.status(403).send({ message: "Forbidden access" });
         }
         const filter = { sellerEmail: email };
         const result = await productsCollection.find(filter).sort({ _id: -1 }).toArray();
         res.status(201).send(result);
      })
      //update product advertise status
      app.put("/products/:id", verifyJWT, verifySeller, async (req, res) => {
         const id = req.params.id;
         const filter = { _id: ObjectId(id) };
         const updateDocument = {
            $set: {
               advertise: true,
            }
         }
         const advertiseResult = await productsCollection.updateOne(filter, updateDocument);
         res.status(201).send(advertiseResult);
      })
      //get all advertise items 
      app.get("/advertiseItems", async (req, res) => {
         const query = { advertise: true };
         const checkAdvertise = await productsCollection.find(query).sort({ _id: - 1 }).toArray();
         res.status(201).send(checkAdvertise);
      })
      //get booking item 
      app.get("/bookingItem/:id", verifyJWT, verifyBuyer ,  async (req, res) => {
         const id = req.params.id;
         const filter = { _id: ObjectId(id) };
         const result = await productsCollection.findOne(filter);
         res.status(201).send(result);
      })
      //get categoray name from categories collection
      app.get("/categoriesName", verifyJWT, verifySeller, async (req, res) => {
         const result = await categoriesCollection.find({}).
            project({ productCategory: -1 }).toArray();
         res.status(201).send(result);
         //get category info 
         app.get("/categoriesInfo/:categoryName", verifyJWT, verifySeller, async (req, res) => {
            const categoryName = req.params.categoryName;
            const filter = { productCategory: categoryName };
            const result = await categoriesCollection.findOne(filter);
            res.status(201).send(result);
         })
      })
//---------------->>
      //availAbleProducts
      app.get("/availAbleProducts/:id", verifyJWT, verifyBuyer, async (req, res) => {
         const id = req.params.id;
         const filter = { categoryId: id };
         const availableProducts = await productsCollection.find(filter).
            sort({ _id: -1 }).toArray();
         res.status(201).send(availableProducts);
      })
      //delete single product
      app.delete("/products/:id", verifyJWT, verifySeller, async (req, res) => {
         const id = req.params.id;
         const query = { _id: ObjectId(id) };
         const deleteProduct = await productsCollection.deleteOne(query);
         res.status(201).send(deleteProduct);
      })    
// update product to add wishList true
app.put("/wishList/"  , verifyJWT , verifyBuyer ,   async(req , res) => {
const updateProduct = req.body ;
const id = updateProduct.productId ;
const buyerEmail = updateProduct.buyerEmail ;
const query = {_id : ObjectId(id)} ;
const productsUpdatedDoc = {
   $set:{
      wishList:true , 
      buyerEmail:buyerEmail, 
   }
}
const result = await productsCollection.updateOne(query , productsUpdatedDoc) ;
res.status(201).send(result) ;

})

//get wish list data

app.get("/wishList/:email" , verifyJWT , verifyBuyer ,  async(req , res) => {
const email = req.params.email ;
const query = {buyerEmail:email} ;
const getWishList = await productsCollection.find(query).toArray() ;
res.status(201).send(getWishList) ;
})

// update product for repot
app.put("/repot/:id" , verifyJWT , verifyBuyer ,  async(req , res) => {
const id = req.params.id ;
const query = {_id : ObjectId(id)} ;
const updateDoc = {
   $set:{
      productIsRepote: "repoted" ,
   }
}
const result = await productsCollection.updateOne(query , updateDoc) ;
res.status(201).send(result) ;
})

//get buyers by seller email 
app.get("/myBuyers/:email" , verifyJWT, verifySeller ,  async(req , res ) => {
const email = req.params.email ;
const filter = {sellerEmail:email} ;
const result = await ordersCollection.find(filter).toArray() ;
res.status(201).send(result) ;
})
      //>>--------------->> Products end from here <<--------------<<

      //>>--------->>---------->>  orders informations start <<-----------<<--------<< 

      //save orders informations 
      app.post("/orders", verifyJWT, verifyBuyer, async (req, res) => {
         const ordersInformation = req.body;
         const result = await ordersCollection.insertOne(ordersInformation);
         res.status(201).send(result);
      })

      //get orders information by specific  email 
      app.get("/orders/:email", verifyJWT, verifyBuyer, async (req, res) => {
         const email = req.params.email;
         const decodedEmail = req.decoded.email;
         if (email !== decodedEmail) {
            return res.status(403).send({ message: "Forbidden access " });
         }
         const query = { email: email };
         const result = await ordersCollection.find(query).sort({ _id: -1 }).toArray();
         res.status(201).send(result);
      })
      //update database
      app.put("/updateDatabase", verifyJWT, verifyBuyer, async (req, res) => {
         const updateInfo = req.body;
         //update orders payment status 
         const ordersId = req.body.ordersId;
         const ordersQuery = { _id: ObjectId(ordersId) };
         const updateOrdersDoc = {
            $set: {
               paid: true,
            }
         }
         const updatedOrdersResult = await ordersCollection.
            updateOne(ordersQuery, updateOrdersDoc);
         //update products advertise 
         const productsId = req.body.productsId;
         const productsQuery = { _id: ObjectId(productsId) }
         const productsUpdatedDoc = {
            $set: {
               advertise: false,
               product: "sold",
               paid:true ,
               wishList:false , 
            }
         }
         const updateProductInformations = await productsCollection.
            updateOne(productsQuery, productsUpdatedDoc);
         res.status(201).send({
            updatedOrdersResult: updatedOrdersResult,
            updateProductInformations: updateProductInformations,
         })
      })
      // get all users 
      app.get("/users" , verifyJWT  ,  verifyBuyer,  async (req , res ) => {
       const result = await usersCollection.find().toArray() ;
       res.status(201).send(result) ;
      })
      //>>--------->>---------->>  orders informations end <<-----------<<--------<< 

      // >>---------->>--------->> payment start from here <<-----------<<--------<< 

      const calculateOrderAmount = (price) => {
         const recivePrice = price * 100;
         return recivePrice;
      };

      app.post("/create-payment-intent", verifyJWT, verifyBuyer, async (req, res) => {
         const price = req.body.price;

         // Create a PaymentIntent with the order amount and currency
         const paymentIntent = await stripe.paymentIntents.create({
            amount: calculateOrderAmount(price),
            currency: "usd",
            "payment_method_types": [
               "card"
            ]
         });

         res.send({
            clientSecret: paymentIntent.client_secret,
         });
      });

      //get product for payment 
      app.get("/productPayment/:id", verifyJWT, verifyBuyer, async (req, res) => {
         const id = req.params.id;
         const filter = { _id: ObjectId(id) };
         const result = await ordersCollection.findOne(filter);
         res.status(201).send(result);
      })
      //
         //get wish list product for payment 
         app.get("/wishListproductPayment/:id", verifyJWT, verifyBuyer, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.findOne(filter);
            res.status(201).send(result);
         })

      // >>---------->>--------->> payment end  from here <<-----------<<--------<< 

      //>>---------------->> Admin permision start <<----------------<<

      //get sellers information
      app.get("/sellers", verifyJWT, verifyAdmin, async (req, res) => {
         const filter = { role: "Seller" };
         const sellers = await usersCollection.find(filter).sort({ _id: -1 }).toArray();
         res.status(201).send(sellers);
      })
      //delete seller account  
      app.delete("/sellers/:id", verifyJWT, verifyAdmin, async (req, res) => {
         const id = req.params.id;
         const query = { _id: ObjectId(id) };
         const deleteSellers = await usersCollection.deleteOne(query);
         res.status(201).send(deleteSellers);
      })
      //verify seller 
      app.put("/sellers", async (req, res) => {
         const selllerData = req.body ;
         const id = selllerData._id;
         const query = { _id: ObjectId(id) };
         const updateDoc = {
            $set: {
               isSellerVerified : true,
            }
         }
         const result = await usersCollection.updateOne(query, updateDoc);
         res.status(201).send(result);
      })
      
      //get  all buyers 
      app.get("/buyers", verifyJWT, verifyAdmin, async (req, res) => {
         const filter = { role: "Buyer" };
         const result = await usersCollection.find(filter).sort({ _id: -1 }).toArray();
         res.status(201).send(result);
      })
      //delete buyer account 
      app.delete("/buyers/:id", verifyJWT, verifyAdmin, async (req, res) => {
         const id = req.params.id;
         const query = { _id: ObjectId(id) };
         const deleteBuyers = await usersCollection.deleteOne(query);
         res.status(201).send(deleteBuyers);
      })
  
      //get repoted items 
      app.get("/repotedItems" , verifyJWT , verifyAdmin ,  async(req , res) => {
      const query = { productIsRepote: "repoted" } ;
      const result = await productsCollection.find(query).toArray() ;
      res.status(201).send(result) ;
      })

      //delete repoted items 
      app.delete(`/deleteRepotedItems/:id`  ,  verifyJWT , verifyAdmin ,  async(req , res) =>{
       const id = req.params.id ;
       const query  = {_id : ObjectId(id)} ;
       const result = await productsCollection.deleteOne(query) ;
       res.status(201).send(result) ;
      })
      //------------------> Admin permision end <----------------
   } catch (error) {
      console.log(error);
   }
   finally {
      //ok
   }
}
runMongoDB().catch(error => console.log(error));

//generate new token token 
app.post("/jwt", async (req, res) => {
   const email = req.body;
   const token = jwt.sign(email, process.env.SECRET_TOKEN, { expiresIn: "12d" });
   res.status(201).send({ token: token });
})

app.listen(port, (req, res) => {
   console.log(`Your resell server running on port : ${port}`);
})