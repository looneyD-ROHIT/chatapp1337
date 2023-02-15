import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { instrument } from '@socket.io/admin-ui';
import { nanoid } from 'nanoid';
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
        origin: ["https://admin.socket.io"],
        credentials: true,
    }
});

// admin page for socket.io
instrument(io, {
    auth: false,
    mode: 'development'
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

// adding a private chat for particular user
app.post('/adduser', (req, res, next)=>{
    if(req.isAuthenticated()){

        let uniqueId = nanoid();

        // check if current user already has connection with other user
        

        User.findOne({username: req.user.username})
            .then(currentUser => {
                if(currentUser){
                    // if current user exists, check for other user
                    User.findOne({username: req.body.username})
                        .then(otherUser =>{

                            let flag1 = false, flag2 = false;
                            if(otherUser){
                                // both user exists, add each to other's connection list 
                                
                                // check if both users are same
                                if(currentUser.username == otherUser.username){
                                    console.log('cannot add self as connection');
                                    return res.json({status: 'fail', msg: 'cannot add self as connection'});
                                }
                                
                                // first add other user to current user's list
                                UserConnections.findOne({username: currentUser.username})
                                               .then(currentConnection => {
                                                    if(currentConnection){
                                                        // current connection already has a existing list
                                                        for(let i=0; i<currentConnection.connectionList.length; i++){
                                                            if(currentConnection.connectionList[i].connectionusername == otherUser.username){
                                                                // connection already exists
                                                                console.log('connection already exists')
                                                                return res.json({status: 'fail', msg: 'other connection already exists in current\'s list'});
                                                            }
                                                        }
                                                        // other connection does not exist in current's list
                                                        currentConnection.connectionList.push({
                                                            connectionname: otherUser.name,
                                                            connectionid: uniqueId,
                                                            connectionusername: otherUser.username,
                                                            isroom: false
                                                        });

                                                        currentConnection.save()
                                                                         .then(response =>{
                                                                            // flag1 = true;
                                                                            console.log(response);
                                                                            // second add current user to other user's list
                                                                            UserConnections.findOne({username: otherUser.username})
                                                                                        .then(otherConnection => {
                                                                                                if(otherConnection){
                                                                                                    // other connection already has a existing list
                                                                                                    for(let i=0; i<otherConnection.connectionList.length; i++){
                                                                                                        if(otherConnection.connectionList[i].connectionusername == currentUser.username){
                                                                                                            // connection already exists
                                                                                                            console.log('current connection already exists in other\'s list')
                                                                                                            return res.json({status: 'fail', msg: 'current connection already exists in other\'s list'});
                                                                                                        }
                                                                                                    }
                                                                                                    // other connection does not exist in current's list
                                                                                                    otherConnection.connectionList.push({
                                                                                                        connectionname: currentUser.name,
                                                                                                        connectionid: uniqueId,
                                                                                                        connectionusername: currentUser.username,
                                                                                                        isroom: false
                                                                                                    });

                                                                                                    otherConnection.save()
                                                                                                                    .then(response =>{
                                                                                                                        flag2 = true;
                                                                                                                        console.log(response);
                                                                                                                        return res.json({status: 'success', msg: 'connection added to each other\'s list'})
                                                                                                                    })
                                                                                                                    .catch(err =>{
                                                                                                                        console.log(err);
                                                                                                                        return res.json({status: 'fail', msg: 'error while saving current connection to other\'s list'});
                                                                                                                    })
                                                                                                }else{
                                                                                                    // current connection has no list
                                                                                                    const newConnection = new UserConnections({
                                                                                                        username: otherUser.username,
                                                                                                        connectionList: [{
                                                                                                            connectionname: currentUser.name,
                                                                                                            connectionid: uniqueId,
                                                                                                            connectionusername: currentUser.username,
                                                                                                            isroom: false
                                                                                                        }]
                                                                                                    });
                                                                                                    newConnection.save()
                                                                                                                .then(response =>{
                                                                                                                    flag2 = true;
                                                                                                                    console.log(response);
                                                                                                                    return res.json({status: 'success', msg: 'connection added to each other\'s list'})
                                                                                                                })
                                                                                                                .catch(err => {
                                                                                                                    console.log(err);
                                                                                                                    return res.json({status: 'fail', msg: 'error while creating current connection to other\'s list'});
                                                                                                                })
                                                                                                }
                                                                                        })
                                                                                        .catch(err => {
                                                                                                console.log(err);
                                                                                                return res.json({status: 'fail', msg: 'error while finding other connection'});
                                                                                        })
                                                                            })
                                                                         .catch(err =>{
                                                                            console.log(err);
                                                                            return res.json({status: 'fail', msg: 'error while saving other connection to current\'s list'});
                                                                         })
                                                    }else{
                                                        // current connection has no list
                                                        const newConnection = new UserConnections({
                                                            username: currentUser.username,
                                                            connectionList: [{
                                                                connectionname: otherUser.name,
                                                                connectionid: uniqueId,
                                                                connectionusername: otherUser.username,
                                                                isroom: false
                                                            }]
                                                        });
                                                        newConnection.save()
                                                                     .then(response =>{
                                                                        // flag1 = true;
                                                                        console.log(response);
                                                                        // second add current user to other user's list
                                                                        UserConnections.findOne({username: otherUser.username})
                                                                                    .then(otherConnection => {
                                                                                            if(otherConnection){
                                                                                                // other connection already has a existing list
                                                                                                for(let i=0; i<otherConnection.connectionList.length; i++){
                                                                                                    if(otherConnection.connectionList[i].connectionusername == currentUser.username){
                                                                                                        // connection already exists
                                                                                                        console.log('current connection already exists in other\'s list')
                                                                                                        return res.json({status: 'fail', msg: 'current connection already exists in other\'s list'});
                                                                                                    }
                                                                                                }
                                                                                                // other connection does not exist in current's list
                                                                                                otherConnection.connectionList.push({
                                                                                                    connectionname: currentUser.name,
                                                                                                    connectionid: uniqueId,
                                                                                                    connectionusername: currentUser.username,
                                                                                                    isroom: false
                                                                                                });

                                                                                                otherConnection.save()
                                                                                                                .then(response =>{
                                                                                                                    flag2 = true;
                                                                                                                    console.log(response);
                                                                                                                    return res.json({status: 'success', msg: 'connection added to each other\'s list'})
                                                                                                                })
                                                                                                                .catch(err =>{
                                                                                                                    console.log(err);
                                                                                                                    return res.json({status: 'fail', msg: 'error while saving current connection to other\'s list'});
                                                                                                                })
                                                                                            }else{
                                                                                                // current connection has no list
                                                                                                const newConnection = new UserConnections({
                                                                                                    username: otherUser.username,
                                                                                                    connectionList: [{
                                                                                                        connectionname: currentUser.name,
                                                                                                        connectionid: uniqueId,
                                                                                                        connectionusername: currentUser.username,
                                                                                                        isroom: false
                                                                                                    }]
                                                                                                });
                                                                                                newConnection.save()
                                                                                                            .then(response =>{
                                                                                                                flag2 = true;
                                                                                                                console.log(response);
                                                                                                                return res.json({status: 'success', msg: 'connection added to each other\'s list'})
                                                                                                            })
                                                                                                            .catch(err => {
                                                                                                                console.log(err);
                                                                                                                return res.json({status: 'fail', msg: 'error while creating current connection to other\'s list'});
                                                                                                            })
                                                                                            }
                                                                                    })
                                                                                    .catch(err => {
                                                                                            console.log(err);
                                                                                            return res.json({status: 'fail', msg: 'error while finding other connection'});
                                                                                    })
                                                                                })
                                                                     .catch(err => {
                                                                        console.log(err);
                                                                        return res.json({status: 'fail', msg: 'error while creating other connection to current\'s list'});
                                                                     })
                                                    }
                                               })
                                               .catch(err => {
                                                    console.log(err);
                                                    return res.json({status: 'fail', msg: 'error while finding current connection'});
                                               })

                            }else{
                                console.log('other user not found')
                                return res.json({status: 'fail', msg: 'other user not found'});
                            }
                        })
                        .catch(err => {
                            console.log(err);
                            return res.json({status: 'fail', msg: 'error while finding other user'});
                        })

                }else{
                    console.log('current user not found')
                    return res.json({status: 'fail', msg: 'current user not found'});
                }

            })
            .catch(err => {
                console.log(err);
                return res.json({status: 'fail', msg: 'error while finding current user'});
            })

    }
    else{
        res.json({status: 'fail', msg: 'not authenticated to add user'});
    }
});

// adding a room for a particular user
app.post('/addroom', (req, res, next)=>{
    if(req.isAuthenticated()){
        Rooms.findOne({roomname: req.body.roomname, roomid: req.body.roomid})
             .then(getRoom => {
                if(getRoom){
                    // room already exists
                    UserConnections.findOne({username: req.user.username})
                                   .then(currentUser => {
                                    if(currentUser){
                                        // user already has a list of connections
                                        for(let i=0; i<currentUser.connectionList.length; i++){
                                            if(currentUser.connectionList[i].connectionid == getRoom.roomid){
                                                return res.json({status: 'fail', msg: 'room already exists in users connection list'});
                                            }
                                        }
                                        currentUser.connectionList.push({
                                            connectionname: getRoom.roomname,
                                            connectionid: getRoom.roomid,
                                            isroom: true,
                                            connectionusername: null,
                                        })
                                        currentUser.save()
                                                   .then((connection) => {
                                                    // console.log(connection);
                                                    return res.json({status: 'success', msg: 'existing room added to existing user list'});
                                                   })
                                                   .catch((err) => {
                                                    console.log('Error while adding room to existing list: '+err)
                                                    return res.json({status: 'fail', msg: 'existing room not added to existing user list'});
                                                   })
                                    }else{
                                        // user does not have a list of connections
                                        const newUserConnection = new UserConnections({
                                            username: req.user.username,
                                            connectionList: [{
                                                connectionname: getRoom.roomname,
                                                connectionid: getRoom.roomid,
                                                isroom: true
                                            }]
                                        });
                                        newUserConnection.save()
                                                         .then((connection) => {
                                                            return res.json({status: 'success', msg: 'existing room added to new user list'})
                                                         })
                                                         .catch(err => {
                                                            console.log('error while saving new room to existing list: '+err);
                                                            return res.json({status: 'fail', msg: 'error while saving existing room to new user list'});
                                                         })
                                    }
                                   })
                                   .catch(err =>{
                                    console.log('error while finding currentUser room already exists: '+err);
                                    return res.json({status: 'fail', msg: 'error while finding currentUser room already exists'})
                                   })
                }else{
                    // room does not exits --> create this room if possible
                    const newRoom = new Rooms({
                        roomname: req.body.roomname,
                        roomid: req.body.roomid
                    });
                    newRoom.save()
                           .then((room) => {
                            // now room is created --> add this to user connections
                            UserConnections.findOne({username: req.user.username})
                                           .then(currentUser => {
                                            if(currentUser){
                                                // user already has a list of connections
                                                currentUser.connectionList.push({
                                                    connectionname: room.roomname,
                                                    connectionid: room.roomid,
                                                    isroom: true
                                                })
                                                currentUser.save()
                                                           .then((connection) => {
                                                            // console.log(connection);
                                                            return res.json({status: 'success', msg: 'new room added to existing user list'});
                                                           })
                                                           .catch((err) => {
                                                            console.log('Error while adding new room to existing list: '+err)
                                                            return res.json({status: 'fail', msg: 'new room not added to existing user list'});
                                                           })
                                            }else{
                                                // user does not have a list of connections
                                                const newUserConnection = new UserConnections({
                                                    username: req.user.username,
                                                    connectionList: [{
                                                        connectionname: getRoom.roomname,
                                                        connectionid: getRoom.roomid,
                                                        isroom: true
                                                    }]
                                                });
                                                newUserConnection.save()
                                                                 .then((connection) => {
                                                                    return res.json({status: 'success', msg: 'new room added to new user list'})
                                                                 })
                                                                 .catch(err => {
                                                                    console.log('error while saving new room to new list: '+err);
                                                                    return res.json({status: 'fail', msg: 'error while saving new room to new user list'});
                                                                 })
                                            }
                                           })
                                           .catch(err=>{
                                                  console.log('error while finding currentUser after saving room: '+err);
                                                  return res.json({status: 'fail', msg: 'error while finding currentUser after saving room'})
                                           })
                           })
                           .catch(err => {
                                 console.log('error while creating room: '+err);
                                 return res.json({status: 'fail', msg: 'error while creating room'})
                           })
                }
             })
             .catch(err => {
                    console.log('error while finding getRoom: '+err);
                    return res.json({status: 'fail', msg: 'error while finding getRoom'})
             })
    }else{
        res.json({status: 'fail', msg: 'not authenticated to add room to user'});
    }
})

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

app.post('/saveroommessages', (req, res, next)=>{
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

app.post('/saveprivateroommessages', (req, res, next)=>{
    if(req.isAuthenticated()){
        
        // first find the room
        console.log('!!!!!!!!!!!!!!!')
        console.log(req.body.roomid)
        Rooms.findOne({ roomid: req.body.roomid })
             .then(room => {

                if(room){

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

                }else{

                    // create room then store messages to server
                    const newRoom = new Rooms({
                        roomid: req.body.roomid,
                        roomname: req.body.roomname,
                    });
                    newRoom.save()
                           .then((nRoom)=>{

                                // then store the messages to the server
                                RoomMessages.findOne({ roomid: nRoom.roomid, roomname: nRoom.roomname })
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
                                            roomid: nRoom.roomid,
                                            roomname: nRoom.roomname,
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
                                console.log('error while saving room: '+err);
                                return res.json({status: 'fail', msg: 'error while saving room'})
                           })

                }

                
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
        console.log(room)
        socket.join(room);
        // console.log(socket.id)
        // console.log(socket.adapter.rooms)
        console.log('User: '+socket.userId+' joined room: '+room)
    })
    socket.on('message', (message) => {
        socket.to(message.room).emit('message', message)
    })
    socket.on('disconnect', (socket) => {
        console.log('User Disconnected: '+ socket.id)
    })
})



httpServer.listen(PORT, ()=>{
    console.log(`Running on http://localhost:${PORT}`);
});
