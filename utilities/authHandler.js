export default function isLoggedIn( req, res, next ) {
    if(req.isAuthenticated())
        next();
    else{
        res.json({status:'fail', message:'Not Authenticated'})
    }
}