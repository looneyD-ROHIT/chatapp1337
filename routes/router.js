import express from 'express';
import passport from 'passport';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import User from '../model/userModel.js';
import RoomMessages from '../model/roomMessages.js';
import UserConnections from '../model/userConnections.js';
import Rooms from '../model/rooms.js';
import isLoggedIn from '../utilities/authHandler.js';

const router = express.Router();

router.get('/', (req, res) => {
    if(req.isAuthenticated()){
        // console.log(req.user)
        res.redirect('/chat');
    }
    else{
        res.render('index');
    }
});

router.get('/login', (req, res, next) => {
    if(req.isAuthenticated()){
        res.redirect('/chat');
    }
    else{
        res.render('login');
    }
});

// Since we are using the passport.authenticate() method, we should be redirected no matter what 
router.post('/login', passport.authenticate('local', { failureRedirect: '/fail', successRedirect: '/chat' }), (err, req, res, next) => {
    if (err){
        console.log(`Error while loggin in ${err}`)
        next(err);
    }
});


router.get('/register', (req, res, next) => {
    if(req.isAuthenticated()){
        res.redirect('/chat');
    }
    else{
        res.render('register');
    }
});

router.post('/register', (req, res, next) => {

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

router.get('/chat', isLoggedIn, async (req, res, next)=>{
    UserConnections.findOne({ username: req.user.username })
        .then(async response => {
            const connList = response ? response.connectionList : [];
            // const userRes = await User.find();
            // userRes.forEach(user => {
            //     connList.push({

            //     })
            // })

            return res.render('chat', {name: req.user.name, username: req.user.username, connectionList: connList})
        })
        .catch(err => {
            console.log(err);
            return res.render('chat', {name: req.user.name, username: req.user.username, connectionList: []});
        })
})

// adding a private chat for particular user
router.post('/adduser', isLoggedIn, (req, res, next)=>{
    let uniqueId = nanoid();

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
});

// adding a room for a particular user
router.post('/addroom', isLoggedIn, (req, res, next)=>{
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
                                        connectionusername: getRoom.roomid,
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
                                            isroom: true,
                                            connectionusername: getRoom.roomid
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
                                                isroom: true,
                                                connectionusername: room.roomid
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
                                                    isroom: true,
                                                    connectionusername: getRoom.roomid
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

})

router.post('/getroommessages', isLoggedIn, (req, res, next)=>{
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
})

router.post('/saveroommessages', isLoggedIn, (req, res, next)=>{
    console.log(req.body)
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
})

router.post('/saveprivateroommessages', isLoggedIn, (req, res, next)=>{
    // console.log('!!!!!!!!!!!!!!!')
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

})

router.get('/fail',  (req, res, next)=>{
    if(req.isAuthenticated()){
        res.redirect('/chat');
    }
    else{
        res.render('fail');
    }
})

router.get('/logout', isLoggedIn, (req, res, next) => {
    if(req.isAuthenticated()){
        req.logout(function(err) {
            if (err) { return next(err); }
        });
    }
    res.redirect('/');
});

router.get('*', (req, res)=>{
    res.json({status: 'fail', msg: 'invalid route'});
})

export default router;