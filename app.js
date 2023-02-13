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
import RoomMessages from './model/roomMessages.js';
import UserConnections from './model/userConnections.js';
import Rooms from './model/rooms.js';
// import UserMessages from './model/userMessages.js';



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
        passportCB(null, { id: user.id, name: user.name, username: user.username });
    });
});

passport.deserializeUser(function(user, passportCB) {
    process.nextTick(function() {
        return passportCB(null, user);
    });
});



// -------------- SESSION SETUP ----------------
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

    console.log(req.body.name)
    const newUser = new User({
        name: `${req.body.name}`,
        username: `${req.body.username}`,
        password: `${hash}`,
        salt: `${salt}`,
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
        // console.log(req.user);
        UserConnections.findOne({ username: req.user.username })
            .then(response => {
                return res.render('chat', {name: req.user.name, username: req.user.username, connectionList: response ? response.connectionList : []})
            })
            .catch(err => {
                console.log(err);
                return res.render('chat', {name: req.user.name, username: req.user.username, connectionList: []});
            })
    }
    else{
        res.redirect('/');
    }
})

app.post('/adduser', (req, res, next)=>{
    if(req.isAuthenticated()){
        User.findOne({username: req.body.username})
            .then(getUser => {
                // user trying to add himself
                if(req.user.username == getUser.username){
                    return res.json({status: 'fail', msg: 'cannot add yourself'});
                }
                UserConnections.findOne({username: req.user.username})
                                .then(currentUser => {
                                    if(currentUser){
                                        
                                        let existingList = currentUser.connectionList;
                                        // console.log(existingList.length)

                                        for(let i=0; i<existingList.length; i++){
                                            if(existingList[i].connectionid == getUser.username){
                                                return res.json({status: 'fail', msg: 'connection already exists in list'});
                                            }
                                        }

                                        currentUser.connectionList.push({ connectionname: getUser.name, connectionid: getUser.username, isroom: false});

                                        currentUser.save()
                                            .then((connection) => {
                                                // console.log(connection);
                                                return res.json({status: 'success', msg: 'connection added to existing list'});
                                            })
                                            .catch((err) => {
                                                console.log('Error while adding connection to existing list: '+err)
                                                return res.json({status: 'fail', msg: 'connection not added to existing list'});
                                            })
                                    }else{
                                        // console.log('before')
                                        const newList = [{
                                            connectionname: getUser.name,
                                            connectionid: getUser.username,
                                            isroom: false
                                        }]
                                        // console.log('after')
                                        const newConnection = new UserConnections({
                                            username: req.user.username,
                                            connectionList: newList
                                        });
                                        newConnection.save()
                                            .then((connection) => {
                                                // console.log(connection);
                                                return res.json({status: 'success', msg: 'connection added'});
                                            })
                                            .catch((err) => {
                                                console.log('Error while adding connection: '+err)
                                                return res.json({status: 'fail', msg: 'connection not added'});
                                            })

                                    }
                                })
                                .catch(err => {
                                    console.log('error while finding currentUser: '+err);
                                    return res.json({status: 'fail', msg: 'error while finding currentUser'})
                                });
            })
            .catch(err => {
                console.log('error while finding getUser: '+err);
                return res.json({status: 'fail', msg: 'error while finding getUser'})
            });
    }
    else{
        res.json({status: 'fail', msg: 'not authenticated to add user'});
    }
});

app.post('/getroommessages', (req, res, next)=>{
    if(req.isAuthenticated()){
       const roomid = req.body.roomid;
       RoomMessages.findOne({roomid: roomid})
                   .then(roomMessages => {
                       if(roomMessages){
                           return res.json({status: 'success', msg: 'room messages found', messages: roomMessages.messages})
                        }
                        else{
                            return res.json({status: 'fail', msg: 'no messages found'})
                        }
                    })
                    .catch(err => {
                        console.log('error while finding room messages: '+err);
                        return res.json({status: 'fail', msg: 'error while finding room messages'})
                    })
                     
    }else{
        res.json({status: 'fail', msg: 'not authenticated to get room messages'});
    }
})
app.post('/roommessages', (req, res, next)=>{
    if(req.isAuthenticated()){
        
        // first find the room
        Rooms.findOne({ roomid: req.body.roomid })
             .then(room => {

                // then store the messages to the server
                RoomMessages.findOne({ roomid: room.roomid, roomname: room.roomname })
                            .then(roomMessage => {
                                if(roomMessage){
                                    // if messages exist previously
                                    roomMessage.messages.push({
                                        message: req.body.message,           
                                        sentBy: req.body.username,
                                        sentByName: req.body.name
                                    });
                                    roomMessage.save()
                                               .then((message) => {
                                                    // console.log(message);
                                                    return res.json({status: 'success', msg: 'message saved to existing room'})
                                               })
                                               .catch(err => {
                                                    console.log('error while saving message to existing room: '+err);
                                                    return res.json({status: 'fail', msg: 'error while saving message to existing room'})
                                               })
                                }else{
                                    // if there are no messages in that room
                                    const newRoomMessage = new RoomMessages({
                                        roomid: room.roomid,
                                        roomname: room.roomname,
                                        messages: [{
                                            message: req.body.message, 
                                            sentBy: req.body.username,
                                            sentByName: req.body.name
                                        }]
                                    });
                                    newRoomMessage.save()
                                                  .then((message) => {
                                                        // console.log(message);
                                                        return res.json({status: 'success', msg: 'message saved to new room'})
                                                  })
                                                  .catch(err => {
                                                        console.log('error while saving message to new room: '+err);
                                                        return res.json({status: 'fail', msg: 'error while saving message to new room'})
                                                    })
                                }
                            })
                            .catch(err => {
                                console.log('error while finding roomMessage: '+err);
                                return res.json({status: 'fail', msg: 'error while finding roomMessage'})
                            })
             })
             .catch(err => {
                console.log('error while finding room: '+err);
                res.json({status: 'fail', msg: 'error while finding room'})
             })
    }else{
        res.json({status: 'fail', msg: 'not authenticated to save messages to room'});
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
    console.log('New User Connected: '+socket.id)
    // console.log('User: '+socket.userId)
    socket.on('setUser', (user) =>{
        socket.userId = user;
        // next();
        console.log('User: '+socket.userId)
    })
    socket.on('join', (room) => {
        socket.join(room);
        console.log('User: '+socket.userId+' joined room: '+room)
    })
    socket.on('message', (msg) => {
        socket.broadcast.emit('message', msg)
    })
    socket.on('disconnect', (socket) => {
        console.log('User Disconnected: '+ socket.id)
    })
})



httpServer.listen(PORT, ()=>{
    console.log(`Running on http://localhost:${PORT}`);
});
