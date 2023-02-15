import morgan from "morgan";
import cors from "cors";
import express from "express";

export default function middlewares(app){
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
}