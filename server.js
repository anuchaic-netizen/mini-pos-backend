const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

// ฟังก์ชันสร้าง Order ID ตามรูปแบบ ปี เดือน วัน ชั่วโมง นาที วินาที (เช่น 20261029-143015)
function generateCustomOrderId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

// ฟังก์ชันสร้างตารางอัตโนมัติเมื่อรันระบบครั้งแรก
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price NUMERIC(10, 2) NOT NULL,
                stock INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                order_id VARCHAR(50) UNIQUE NOT NULL,
                total_amount NUMERIC(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const checkProduct = await pool.query(`SELECT COUNT(*) FROM products`);
        if (parseInt(checkProduct.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO products (name, price, stock) VALUES 
                ('กาแฟดำเย็น', 45, 100),
                ('ชาไทยนมสด', 50, 100),
                ('ครัวซองต์เนยสด', 65, 50);
            `);
            console.log('📦 เพิ่มข้อมูลสินค้าตัวอย่างลงใน PostgreSQL เรียบร้อยแล้ว');
        }
    } catch (err) {
        console.error('❌ เกิดข้อผิดพลาดในการสร้างตาราง:', err.message);
    }
}

initDatabase();

// --- API: ดึงรายการสินค้าทั้งหมด ---
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API: ชำระเงิน + บันทึกบิล + ตัดสต็อกอัตโนมัติ (Transaction) ---
app.post('/api/checkout', async (req, res) => {
    const { items, total_amount } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'ไม่มีสินค้าในตะกร้า' });
    }

    // เริ่มต้น Transaction (ความปลอดภัยของฐานข้อมูล)
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. ตรวจสอบสต็อกสินค้าก่อนว่าเพียงพอไหม
        for (let item of items) {
            const productCheck = await client.query('SELECT stock, name FROM products WHERE id = $1', [item.id]);
            if (productCheck.rows.length === 0) {
                throw new Error(`ไม่พบสินค้า ID: ${item.id} ในระบบ`);
            }
            const currentStock = productCheck.rows[0].stock;
            if (currentStock < item.quantity) {
                throw new Error(`สินค้า "${productCheck.rows[0].name}" มีจำนวนในสต็อกไม่พอ (เหลือ ${currentStock} ชิ้น)`);
            }
        }

        // 2. สร้าง Order ID ใหม่
        const customOrderId = generateCustomOrderId();

        // 3. บันทึกลงตาราง orders
        await client.query(
            `INSERT INTO orders (order_id, total_amount) VALUES ($1, $2)`,
            [customOrderId, total_amount]
        );

        // 4. ตัดสต็อกสินค้าในตาราง products ทีละรายการอัตโนมัติ
        for (let item of items) {
            await client.query(
                `UPDATE products SET stock = stock - $1 WHERE id = $2`,
                [item.quantity, item.id]
            );
        }

        // ยืนยันการเปลี่ยนแปลงทั้งหมดลงฐานข้อมูลจริง
        await client.query('COMMIT');
        
        res.json({ 
            success: true, 
            message: 'ชำระเงินและตัดสต็อกสำเร็จ', 
            order_id: customOrderId,
            total_amount: total_amount 
        });

    } catch (err) {
        // หากเกิดข้อผิดพลาด ให้ยกเลิกการเปลี่ยนแปลงทั้งหมดทันที (Rollback)
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, error: err.message });
    } finally {
        // คืน connection กลับสู่พูล
        client.release();
    }
});

// --- API: ดึงประวัติการสั่งซื้อทั้งหมด ---
app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 20');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API: เพิ่มสินค้าใหม่ลงในฐานข้อมูล ---
app.post('/api/products', async (req, res) => {
    const { name, price, stock } = req.body;

    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ success: false, error: 'กรุณากรอกข้อมูลสินค้าให้ครบถ้วน' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO products (name, price, stock) VALUES ($1, $2, $3) RETURNING *`,
            [name, price, stock]
        );

        res.json({ 
            success: true, 
            message: 'เพิ่มสินค้าสำเร็จ', 
            product: result.rows[0] 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- API: ลบสินค้าออกจากระบบ ---
app.delete('/api/products/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
        res.json({ success: true, message: 'ลบสินค้าสำเร็จ' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Backend (PostgreSQL) ทำงานอยู่ที่ http://localhost:${PORT}`);
});