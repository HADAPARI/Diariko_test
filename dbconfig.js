const mysql = require('mysql');
require('dotenv').config();

const db = mysql.createConnection({
    host:process.env.DATABASE_HOST,
    database:process.env.DATABASE_NAME,
    user:process.env.DATABASE_USER,
    password:process.env.DATABASE_PASSWORD
});

db.connect();

// exports.db = db;
module.exports = db;
