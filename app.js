require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const port = process.env.PORT || 3000;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true, 
    connectionLimit: 10,      
    queueLimit: 0             
});

app.use(express.json());

async function testDbConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Connected to MySQL database successfully!');
        connection.release();
    } catch (error) {
        console.error('Failed to connect to MySQL database:', error.message);
        console.log('Please ensure your MySQL Docker container is running and accessible.');
        process.exit(1);
    }
}


testDbConnection();

app.get('/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
});

app.get('/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error(`Error fetching product with id ${productId}:`, error);
        res.status(500).json({ message: `Error fetching product with id ${productId}`, error: error.message });
    }
});

app.get('/products/search/:keyword', async (req, res) => {
    const keyword = req.params.keyword;
    const searchTerm = `%${keyword}%`;
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE name LIKE ?', [searchTerm]);
        res.json(rows);
    } catch (error) {
        console.error(`Error searching products with keyword "${keyword}":`, error);
        res.status(500).json({ message: `Error searching products with keyword "${keyword}"`, error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Express API listening at http://localhost:${port}`);
    console.log('You can test the API endpoints:');
    console.log(`- GET http://localhost:${port}/products`);
    console.log(`- GET http://localhost:${port}/products/1`);
    console.log(`- GET http://localhost:${port}/products/search/เสื้อ`);
});

app.post('/products', async (req, res) => {
    const { name, price, discount, review_count, image_url } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO products (name, price, discount, review_count, image_url) VALUES (?, ?, ?, ?, ?)',
            [name, price, discount, review_count, image_url]
        );
        res.status(201).json({ id: result.insertId, name, price, discount, review_count, image_url });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Error creating product', error: error.message });
    }
});

app.put('/products/:id', async (req, res) => {
    const { name, price, discount, review_count, image_url } = req.body;
    const id = req.params.id;
    try {
        const [result] = await pool.query(
            'UPDATE products SET name = ?, price = ?, discount = ?, review_count = ?, image_url = ? WHERE id = ? AND deleted_at IS NULL',
            [name, price, discount, review_count, image_url, id]
        );
        if (result.affectedRows > 0) {
            res.json({ message: 'Product updated successfully' });
        } else {
            res.status(404).json({ message: 'Product not found or already deleted' });
        }
    } catch (error) {
        console.error(`Error updating product ${id}:`, error);
        res.status(500).json({ message: 'Error updating product', error: error.message });
    }
});

app.delete('/products/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const [result] = await pool.query(
            'UPDATE products SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
            [id]
        );
        if (result.affectedRows > 0) {
            res.json({ message: 'Product soft-deleted successfully' });
        } else {
            res.status(404).json({ message: 'Product not found or already deleted' });
        }
    } catch (error) {
        console.error(`Error soft-deleting product ${id}:`, error);
        res.status(500).json({ message: 'Error soft-deleting product', error: error.message });
    }
});

app.patch('/products/:id/restore', async (req, res) => {
    const id = req.params.id;
    try {
        const [result] = await pool.query(
            'UPDATE products SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
            [id]
        );
        if (result.affectedRows > 0) {
            res.json({ message: 'Product restored successfully' });
        } else {
            res.status(404).json({ message: 'Product not found or not deleted' });
        }
    } catch (error) {
        console.error(`Error restoring product ${id}:`, error);
        res.status(500).json({ message: 'Error restoring product', error: error.message });
    }
});
