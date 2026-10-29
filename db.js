const { Pool } = require('pg');

// ตรวจสอบว่ามี DATABASE_URL จาก Render หรือไม่
const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
    connectionString 
        ? {
            connectionString: connectionString,
            ssl: {
                rejectUnauthorized: false // จำเป็นสำหรับการต่อฐานข้อมูลบน Cloud
            }
          }
        : {
            user: 'postgres',
            host: 'localhost',
            database: 'mini_pos',
            password: 'root',
            port: 5432,
          }
);

pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ เชื่อมต่อ PostgreSQL ล้มเหลว:', err.stack);
    }
    console.log('✅ เชื่อมต่อฐานข้อมูล PostgreSQL บน Render สำเร็จ');
    release();
});

module.exports = pool;