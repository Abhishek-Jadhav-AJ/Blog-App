
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import  express  from "express";
import 'dotenv/config';
import { MongoClient } from "mongodb";  

import { fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const credentials = JSON.parse (
   fs.readFileSync('./credentials.json')
);

admin.initializeApp({
    credential : admin.credential.cert(credentials),
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname , '../build')));

app.get(/^(?!\/api).+/,(req,res) =>{
    res.sendFile(path.join(__dirname , '../build/index.html'));
})




app.use( async (req , res , next) => {
    const { authtoken } = req.header; 

    if(authtoken ){
        try {
            req.user = await admin.auth().verifyIdToken(authtoken);
        } 
        catch(e){
            return res.sendStatus(400);
        }
    }

    req.user = req.user || {} ; 

    next();
});

app.get('/api/articles/:name' , async (req , res) =>{

    const {name} = req.params;
    const { uid } = req.user ; 

    const client = new MongoClient(`mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.zdltwut.mongodb.net/?retryWrites=true&w=majority`);
    await client.connect();

    const db = client.db('react-blog-db');

    const article = await db.collection('articles').findOne({ name });

    if(article) {
        const upvoteIds = article.upvoteIds || [];
        article.canUpvote = uid && !upvoteIds.includes(uid); 
        res.json(article);
    }else{
        res.sendStatus(404);
    }
});

app.use((req, res, next) => {
    if (req.user) {
        next();
    } else {
        res.sendStatus(401);
    }
});

app.put('/api/articles/:name/upvote' ,async (req ,res) => {
    const {name} = req.params;
    const { uid } = req.user;
    

    const client = new MongoClient(`mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.zdltwut.mongodb.net/?retryWrites=true&w=majority`);
    await client.connect();

    const db = client.db('react-blog-db');

    await db.collection('articles').updateOne({ name } , {
        $inc: { upvotes: 1 },
    });

    const article = await db.collection('articles').findOne({name});
    
    if(article){
        const upvoteIds = article.upvoteIds || [];
        const canUpvote = uid && !upvoteIds.includes(uid);

        if (canUpvote) {
            await db.collection('articles').updateOne({ name }, {
                $inc: { upvotes: 1 },
                $push: { upvoteIds: uid },
            });
        }

        const updatedArticle = await db.collection('articles').findOne({ name });
        res.json(updatedArticle);

    }else{
        res.send(`The article doesn\'t exist`);
    }
});

app.post('/api/articles/:name/comments' , async (req,res) => {
    
    const { name } = req.params;
    const { text } = req.body;
    const { email } = req.user;

    const client = new MongoClient(`mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.zdltwut.mongodb.net/?retryWrites=true&w=majority`);
    await client.connect();
    const db = client.db('react-blog-db');

    await db.collection('articles').updateOne({name} , {
        $push : {comments: {postedBy: email , text}},
    })

    const article = await db.collection('articles').findOne({name});
    if(article){
        // article.comments.push({ postedBy , text });
        res.json(article);
    }
    else{
        res.send(`The article doesn\t exist`);
    }

});

app.get('/hello' , (req , res) => {
    res.send(`Helllo! ${req.body.name}`); 
})

const PORT = process.env.PORT || 8000 ;


app.listen(PORT , ()=>{
    console.log('Server is listing on port '+ PORT)
})
