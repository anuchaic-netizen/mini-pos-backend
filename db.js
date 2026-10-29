const { Pool } = require('pg');

// ตั้งค่าการเชื่อมต่อ (ปรับเปลี่ยน User, Password และ Database ตามเครื่องของคุณ)
const pool = new Pool({
    user: 'postgres',         // ชื่อผู้ใช้งาน PostgreSQL ของคุณ (ค่าเริ่มต้นมักเป็น postgres)
    host: 'localhost',
    database: 'mini_pos',     // ชื่อฐานข้อมูลที่คุณสร้างไว้ใน PostgreSQL
    password: 'root',         // รหัสผ่านฐานข้อมูลของคุณ
    port: 5432,               // พอร์ตมาตรฐานของ PostgreSQL
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ เชื่อมต่อ PostgreSQL ล้มเหลว:', err.stack);
    }
    console.log('✅ เชื่อมต่อฐานข้อมูล PostgreSQL สำเร็จ');
    release();
});

module.exports = pool;