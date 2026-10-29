const { Pool } = require('pg');

// ตรวจสอบว่ามี DATABASE_URL จาก Render หรือไม่ (ถ้าไม่มีค่อยใช้ค่า localhost สำหรับรันบนเครื่อง)
const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
    connectionString 
        ? {
            connectionString: connectionString,
            ssl: {
                rejectUnauthorized: false // จำเป็นสำหรับการเชื่อมต่อ PostgreSQL บน Cloud (Render)
            }
          }
        : {
            user: 'postgres',
            host: 'localhost',
            database: 'mini_pos',
            password: 'your_password',
            port: 5432,
          }
);

pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ เชื่อมต่อ PostgreSQL ล้มเหลว:', err.stack);
    }
    console.log('✅ เชื่อมต่อฐานข้อมูล PostgreSQL สำเร็จ');
    release();
});

module.exports = pool;