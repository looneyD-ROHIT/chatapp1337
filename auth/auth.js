import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import crypto from 'crypto';
import User from '../model/userModel.js'

export default function(){

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
}