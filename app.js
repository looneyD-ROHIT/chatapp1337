import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { instrument } from '@socket.io/admin-ui';
import passport from 'passport';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import path from 'path';
import router from './routes/router.js';
import auth from './auth/auth.js';
import middlewares from './utilities/controller.js';
import connection from './utilities/connection.js';

const PORT = process.env.PORT || 1337;

// const HOST = '0.0.0.0';
const HOST = '127.0.0.1';

// Create the Express application
const app = express();

// middlewares setup
middlewares(app);

// connect to database
connection();

// passport local authentication
auth();

// session specific middlewares
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

// middlewares to be run only if user is authenticated
app.use('/public', express.static(path.resolve(path.dirname('.'), 'public')));
// app.use('/src', express.static(path.resolve(path.dirname('.'), 'src')));

// routes
app.use('/', router)

// Create the HTTP server
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

// socket based operations
io.on('connection', (socket) => {
    console.log('New User Connected: '+socket.id)
    
    
    // console.log('User: '+socket.userId)
    socket.on('setUser', (user) =>{
        socket.userId = user;
        // next();
        console.log('User: '+socket.userId);
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
    socket.on('disconnect', () => {
        console.log('User Disconnected: '+ socket.id)
        const data = {
            username: socket.userId,
            isActive: false
        }
        socket.broadcast.emit('online-status', data)
    })

    
    socket.on('online-status', (data)=>{
        socket.broadcast.emit('online-status', data)
    })
})

// listen for requests
httpServer.listen(PORT, HOST, ()=>{
    console.log(`Running on http://localhost:${PORT}`);
});
