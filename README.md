# ReStore - Second Hand Marketplace

ReStore is a web-based platform designed for buying and selling second-hand items. It provides a seamless experience for users to list their pre-loved items and for buyers to find affordable treasures.

## Features

- **User Authentication**: Secure Login and Registration system.
- **Product Management**: 
  - Create detailed listings with images.
  - Specify item condition and usage duration.
- **Search & Sort**: 
  - Search for products by keywords.
  - Sort by price, condition, usage time, and sales popularity.
- **Shopping Cart**: Add items to cart with quantity selection.
- **Orders**: View order history and purchase details.
- **Messaging**: Contact sellers directly (Chat feature).
- **Address Management**: Save and manage shipping addresses.
- **Dashboard**: comprehensive dashboard for users to manage their listings and account settings.

## Technologies

- **Frontend**: HTML5, CSS3, JavaScript, Bootstrap 5.
- **Backend**: Native PHP.
- **Database**: MySQL.
- **Font**: Inter (Google Fonts).

## Installation & Setup

### Prerequisites
- [XAMPP](https://www.apachefriends.org/) or any similar PHP/MySQL development environment.

### Steps

1. **Clone/Download** the project:
   Place the project folder in your web server's root directory (e.g., `C:\xampp\htdocs\final_proj`).

2. **Start Server**:
   Open XAMPP Control Panel and start **Apache** and **MySQL**.

3. **Database Setup**:
   - Open your browser and go to `http://localhost/phpmyadmin`.
   - Create a new database named `second_hand_db`.
   
4. **Import Schema**:
   You can set up the database using the provided script or manually:
   
   **Option A: Automatic Setup**
   - Visit `http://localhost/final_proj/apply_schema.php` in your browser. This script will execute the SQL dump file.
   
   **Option B: Manual Import**
   - In phpMyAdmin, select the `second_hand_db` database.
   - Click "Import" tab.
   - Choose the file `second_hand_db.sql` from the project root.
   - Click "Import".

## Configuration

Database configuration is located in `api/db.php`.
Default XAMPP settings are used:
- **Host**: localhost
- **User**: root
- **Password**: (empty)
- **Database**: second_hand_db

If you have a different setup, please update `api/db.php` accordingly.

## Usage

Access the application via:
`http://localhost/final_proj`
