import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

export default function(){
    const MONGO_URL = process.env.DB_STRING;
    
    mongoose.set("strictQuery", false);
    
    mongoose.connect(MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log(`Database Connection Established!`))
    .catch(err => console.log(`Database Connection Failed! ` + err));
}