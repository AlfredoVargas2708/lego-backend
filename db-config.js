const { Pool } = require('pg')
require('dotenv').config();

const pool = new Pool({
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    password: process.env.PGPASSWORD,
    port: 5432,
    ssl: {
        rejectUnauthorized: false,
    },
    user: process.env.PGUSER
})

module.exports = pool