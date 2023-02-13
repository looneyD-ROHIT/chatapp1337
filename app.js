import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import path from 'path';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
import passport from 'passport';
import crypto from 'crypto';
import { Strategy as LocalStrategy } from 'passport-local';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';

dotenv.config();


const PORT = process.env.PORT || 1337;

// Create the Express application
const app = express();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*',
    }
});


// generic middlewares for basic express functionality
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// templating engine
app.set('view engine', 'ejs');


// prevent browser caching
app.use((req, res, next)=>{
    res.set('Cache-control', 'no-store')
    next()
})


// -------------- DATABASE ----------------

const MONGO_URL = process.env.DB_STRING;

// MongoDB specific options

mongoose.set("strictQuery", false);

mongoose.connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log(`Database Connection Established!`))
.catch(err => console.log(`Database Connection Failed! ` + err));

// importing the models/schemas
import User from './model/userModel.js';
import Rooms from './model/roomModel.js';
import UserConnections from './model/userConnections.js';
import UserMessages from './model/userMessages.js';



// -------------- PASSPORT-LOCAL AUTH ----------------
passport.use(new LocalStrategy(
    function(username, password, passportCB) {
        User.findOne({ username: username })
            .then((user) => {

                // if user does not exist
                if (!user) { return passportCB(null, false) }
                
                const hashVerify = crypto.pbkdf2Sync(password, user.salt, 10000, 64, 'sha512').toString('hex');
                const isValid = user.password == hashVerify;
                
                // if user exists and password is valid
                if (isValid) {
                    return passportCB(null, user);
                } else {
                    return passportCB(null, false);
                }
            })
            .catch((err) => {   
                passportCB(err);
            });
}));


passport.serializeUser(function(user, passportCB) {
    process.nextTick(function() {
        passportCB(null, { id: user.id, username: user.username });
    });
});

passport.deserializeUser(function(user, passportCB) {
    process.nextTick(function() {
        return passportCB(null, user);
    });
});



/**
 * -------------- SESSION SETUP ----------------
 */
app.use(session({
    secret: 'good boy chatting now',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.DB_STRING,
    }),
    cookie: {
        maxAge: 1000 * 60 * 60  * 24
    }
}));

app.use(passport.authenticate('session'));
// app.use(passport.initialize());
// app.use(passport.session());


function isLoggedIn( req, res, next ) {
    if(req.isAuthenticated())
        next();
    else{
        res.json({status:'fail', message:'Not Authenticated'})
    }
}



// middlewares to be run only if user is authenticated
app.use('/public', express.static(path.resolve(path.dirname('.'), 'public')));


//-------------- ROUTES ----------------

app.get('/', (req, res) => {
    if(req.isAuthenticated()){
        // console.log(req.user)
        res.redirect('/chat');
    }
    else{
        res.render('index');
    }
});

app.get('/login', (req, res, next) => {
    if(req.isAuthenticated()){
        res.redirect('/chat');
    }
    else{
        res.render('login');
    }
});

// Since we are using the passport.authenticate() method, we should be redirected no matter what 
app.post('/login', passport.authenticate('local', { failureRedirect: '/fail', successRedirect: '/chat' }), (err, req, res, next) => {
    if (err){
        console.log(`Error while loggin in ${err}`)
        next(err);
    }
});


app.get('/register', (req, res, next) => {
    if(req.isAuthenticated()){
        res.redirect('/chat');
    }
    else{
        res.render('register');
    }
});

app.post('/register', (req, res, next) => {

    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(req.body.password, salt, 10000, 64, 'sha512').toString('hex');

    const newUser = new User({
        username: req.body.username,
        password: hash,
        salt: salt,
        admin: req.body.admin
    });

    const jsonData = {
        status: 'success',
        msg: 'registered'
    }
    newUser.save()
        .then((user) => {
            console.log(user);
            console.log(jsonData)
            res.json(jsonData);
        }).catch((err) => {
            console.log('Error while registering: '+err)
            jsonData.status = 'fail';
            jsonData.msg = 'not registered'
            console.log(jsonData)
            res.json(jsonData);
        })


});

app.get('/chat', (req, res, next)=>{
    if(req.isAuthenticated()){
        res.render('chat', {username: req.user.username});
    }
    else{
        res.redirect('/');
    }
})

app.get('/fail',  (req, res, next)=>{
    if(req.isAuthenticated()){
        res.redirect('/chat');
    }
    else{
        res.render('fail');
    }
})


app.get('/logout', (req, res, next) => {
    if(req.isAuthenticated()){
        req.logout(function(err) {
            if (err) { return next(err); }
        });
    }
    res.redirect('/');
});



app.get('*', (req, res)=>{
    res.redirect('/');
})


// socket based operations

io.on('connection', (socket) => {
    console.log('Connected...')
    socket.on('message', (msg) => {
        socket.broadcast.emit('message', msg)
    })
})



httpServer.listen(PORT, ()=>{
    console.log(`Running on http://localhost:${PORT}`);
});
