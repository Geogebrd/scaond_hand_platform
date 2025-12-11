const API_BASE = 'api';

// Utility to handle API requests
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {}
    };

    if (data instanceof FormData) {
        options.body = data;
    } else if (data) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
    }

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        return await res.json();
    } catch (e) {
        console.error('API Error:', e);
        return { error: 'Connection error' };
    }
}

// Auth State
let currentUser = null;

async function checkAuth() {
    const res = await apiCall('/auth.php?action=check');
    if (res.authenticated) {
        currentUser = res.user;
        updateNav();
    }
}


// Cart Logic
async function addToCart(productId, quantity = 1) {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    const res = await apiCall('/cart.php?action=add', 'POST', { product_id: productId, quantity: quantity });

    if (res.success) {
        alert('Added to cart!');
        updateNav(); // useful if we show cart count
    } else {
        alert(res.error || 'Failed to add to cart');
    }
}

async function loadCart() {
    const list = document.getElementById('cart-items');
    const summary = document.getElementById('cart-summary');
    const totalEl = document.getElementById('cart-total-price');
    if (!list) return;

    if (!currentUser) {
        list.innerHTML = '<p>Please login to view your cart.</p>';
        return;
    }

    const items = await apiCall('/cart.php');

    if (items.error) {
        list.innerHTML = `<p>${items.error}</p>`;
        return;
    }

    if (!items.length) {
        list.innerHTML = '<p>Your cart is empty.</p>';
        summary.style.display = 'none';
        return;
    }

    let total = 0;
    let hasSoldItems = false;

    list.innerHTML = items.map(item => {
        const isSold = item.status === 'sold';
        // Note: item.cart_quantity comes from API
        const qty = item.cart_quantity || 1;

        if (!isSold) {
            total += parseFloat(item.price) * qty;
        } else {
            hasSoldItems = true;
        }

        return `
        <div class="cart-item ${isSold ? 'cart-item-sold' : ''}">
            <img src="${item.image_url || 'https://via.placeholder.com/100'}" class="cart-item-image" alt="${item.title}">
            <div class="cart-item-info">
                <h4>${item.title} ${isSold ? '<span class="badge badge-sold">SOLD OUT</span>' : ''}</h4>
                <div class="cart-item-price">$${parseFloat(item.price).toFixed(2)} x ${qty}</div>
                <button onclick="removeFromCart(${item.cart_id})" class="btn btn-outline btn-sm">Remove</button>
            </div>
        </div>
        `;
    }).join('');

    totalEl.textContent = `$${total.toFixed(2)}`;

    // Disable checkout if only sold items? Or just allow checkout of remaining.
    // Generally we want user to remove sold items first or we ignore them.
    // Let's prompt user to remove them.
    if (hasSoldItems) {
        document.querySelector('#cart-summary button').textContent = 'Remove Sold Items to Checkout';
        document.querySelector('#cart-summary button').disabled = true;
        document.querySelector('#cart-summary button').classList.add('btn-disabled');
    } else {
        document.querySelector('#cart-summary button').textContent = 'Checkout';
        document.querySelector('#cart-summary button').disabled = false;
        document.querySelector('#cart-summary button').classList.remove('btn-disabled');
    }

    // Pre-fill user data if available
    const userSettings = await apiCall('/settings.php');
    if (!userSettings.error) {
        const nameInput = document.getElementById('ship-name');
        const phoneInput = document.getElementById('ship-phone');
        const addrInput = document.getElementById('ship-address');

        if (nameInput && !nameInput.value) nameInput.value = userSettings.real_name || '';
        if (phoneInput && !phoneInput.value) phoneInput.value = userSettings.phone || '';
        if (addrInput && !addrInput.value) addrInput.value = userSettings.address || '';
    }

    summary.style.display = 'block';
}

async function removeFromCart(cartId) {
    if (!confirm('Remove this item?')) return;

    const res = await apiCall('/cart.php?action=remove', 'POST', { cart_id: cartId });
    if (res.success) {
        loadCart();
    } else {
        alert(res.error || 'Failed to remove item');
    }
}

async function checkout() {
    const name = document.getElementById('ship-name').value.trim();
    const phone = document.getElementById('ship-phone').value.trim();
    const address = document.getElementById('ship-address').value.trim();

    // If user didn't type anything, just send empties, the backend will check DB or return MISSING_ADDRESS

    // Better UX: Validation only if all empty and we might need to prompt
    // But since backend falls back, we can just send what we have.

    if (!confirm('Proceed to checkout?')) return;

    const res = await apiCall('/cart.php?action=checkout', 'POST', {
        shipping_name: name,
        shipping_phone: phone,
        shipping_address: address
    });

    if (res.success) {
        alert('Checkout successful! Thank you for your purchase.');
        window.location.href = 'index.html';
    } else {
        if (res.error === 'MISSING_ADDRESS') {
            if (confirm('You have no shipping address saved. Please set your address in Settings to proceed.')) {
                window.location.href = 'settings.html';
            }
        } else {
            alert(res.error || 'Checkout failed');
        }
    }
}


// Dashboard Logic
// Dashboard Logic
async function loadSellerDashboard() {
    const tbody = document.getElementById('listings-body');
    if (!tbody) return;

    const res = await apiCall('/dashboard.php');
    const products = Array.isArray(res) ? res : (res.listings || []);
    const sales = Array.isArray(res) ? [] : (res.sales || []);

    // Listings Table
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No listings found.</td></tr>';
    } else {
        tbody.innerHTML = products.map(p => {
            const soldQty = p.sold_quantity || 0;
            const totalQty = p.quantity !== undefined ? p.quantity : 1;
            const available = p.is_unlimited ? 9999 : (totalQty - soldQty);
            const isOutOfStock = !p.is_unlimited && available <= 0;
            const statusColor = isOutOfStock ? '#fee2e2' : '#dcfce7';
            const statusText = isOutOfStock ? 'SOLD OUT' : 'AVAILABLE';
            const stockDisplay = p.is_unlimited ? '∞' : `${available} left / ${soldQty} sold`;

            return `
                <tr>
                    <td>${p.title}</td>
                    <td>$${parseFloat(p.price).toFixed(2)}</td>
                    <td><span class="badge" style="background: ${statusColor}; color: ${isOutOfStock ? '#991b1b' : '#166534'};">${statusText}</span></td>
                    <td>${stockDisplay}</td>
                    <td>${new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
            `;
        }).join('');
    }

    // Sales Section with Tabs
    let salesContainer = document.getElementById('sales-container');
    if (!salesContainer) {
        const cardContainer = document.querySelector('.card-container');
        if (cardContainer) {
            salesContainer = document.createElement('div');
            salesContainer.id = 'sales-container';
            salesContainer.className = 'card-container';
            salesContainer.style.marginTop = '2rem';

            salesContainer.innerHTML = `
                <h3>Order Management</h3>
                <div class="tabs" style="margin: 1rem 0; border-bottom: 2px solid #eee;">
                    <button class="tab-btn active" onclick="switchTab('pending')" style="padding: 0.5rem 1rem; border: none; background: transparent; cursor: pointer; border-bottom: 2px solid #2563eb; font-weight: 600;">To Ship</button>
                    <button class="tab-btn" onclick="switchTab('shipped')" style="padding: 0.5rem 1rem; border: none; background: transparent; cursor: pointer;">Shipped</button>
                    <button class="tab-btn" onclick="switchTab('received')" style="padding: 0.5rem 1rem; border: none; background: transparent; cursor: pointer;">Completed</button>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Details</th>
                                <th>Buyer Info</th>
                                <th>Shipping Info</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="sales-body"></tbody>
                    </table>
                </div>
            `;
            cardContainer.parentNode.appendChild(salesContainer);
        }
    }

    // Store sales globally for filtering
    window.allSales = sales;
    switchTab('pending'); // Default view
}

window.switchTab = function (status) {
    const salesBody = document.getElementById('sales-body');
    const tabs = document.querySelectorAll('.tab-btn');

    // Update tabs
    tabs.forEach(t => {
        if (t.textContent.toLowerCase().includes(status === 'pending' ? 'to ship' : (status === 'shipped' ? 'shipped' : 'completed'))) {
            t.style.borderBottom = '2px solid #2563eb';
            t.style.fontWeight = '600';
            t.classList.add('active');
        } else {
            t.style.borderBottom = 'none';
            t.style.fontWeight = '400';
            t.classList.remove('active');
        }
    });

    // Filter
    let filtered = [];
    if (status === 'received') {
        filtered = window.allSales.filter(s => s.shipping_status === 'received');
    } else {
        filtered = window.allSales.filter(s => s.shipping_status === status || (!s.shipping_status && status === 'pending'));
    }

    if (filtered.length === 0) {
        salesBody.innerHTML = '<tr><td colspan="6">No orders in this category.</td></tr>';
        return;
    }

    salesBody.innerHTML = filtered.map(s => {
        let actionBtn = '';
        if (status === 'pending') {
            actionBtn = `<button onclick="updateOrderStatus(${s.order_id}, 'shipped')" class="btn btn-primary btn-sm">Ship Order</button>`;
        } else if (status === 'shipped') {
            actionBtn = `<button onclick="updateOrderStatus(${s.order_id}, 'pending')" class="btn btn-outline btn-sm">Revert to Pending</button>`;
        } else {
            actionBtn = `<span class="badge" style="background:#dcfce7; color:#166534">Completed</span>`;
        }

        return `
             <tr>
                <td>${s.title}</td>
                <td>
                    Qty: ${s.quantity || 1}<br>
                    Total: $${parseFloat(s.total_price).toFixed(2)}<br>
                    Date: ${new Date(s.sale_date).toLocaleDateString()}
                </td>
                 <td>
                    <div>${s.buyer_name}</div>
                    <a href="chat.html?user_id=${s.buyer_id}" style="font-size:0.8rem;">Message</a>
                </td>
                <td style="font-size: 0.9rem;">
                    <strong>${s.shipping_name || '-'}</strong><br>
                    ${s.shipping_phone || '-'}<br>
                    ${s.shipping_address || '-'}
                </td>
                <td>
                    <span class="badge" style="background: ${s.shipping_status === 'shipped' ? '#e0f2fe' : (s.shipping_status === 'received' ? '#dcfce7' : '#f3f4f6')}">
                        ${s.shipping_status || 'pending'}
                    </span>
                    ${s.shipped_at ? `<div style="font-size:0.75rem; margin-top:2px;">Shipped: ${new Date(s.shipped_at).toLocaleDateString()}</div>` : ''}
                </td>
                <td>${actionBtn}</td>
            </tr>
        `;
    }).join('');
};

window.updateOrderStatus = async function (orderId, status) {
    if (!confirm(status === 'shipped' ? 'Mark this order as shipped?' : 'Revert this order to pending?')) return;

    const res = await apiCall('/dashboard.php?action=update_status', 'POST', { order_id: orderId, status: status });
    if (res.success) {
        loadSellerDashboard(); // Reload
    } else {
        alert(res.error || 'Update failed');
    }
};

// Chat Logic
let activeChatUserId = null;

async function initChat() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUserId = urlParams.get('user_id');

    await loadConversations();

    if (targetUserId) {
        loadChatHistory(targetUserId);
    }

    // Handle send
    const form = document.getElementById('chat-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('message-input');
            const content = input.value.trim();
            if (!content || !activeChatUserId) return;

            const res = await apiCall('/messages.php?action=send', 'POST', {
                receiver_id: activeChatUserId,
                content: content
            });

            if (res.success) {
                input.value = '';
                await loadChatHistory(activeChatUserId); // Refresh
            } else {
                alert('Failed to send');
            }
        });
    }
}

async function loadConversations() {
    const list = document.getElementById('conversation-list');
    if (!list) return;

    const users = await apiCall('/messages.php');
    if (users.length === 0) {
        list.innerHTML = '<li>No conversations yet.</li>';
        return;
    }

    list.innerHTML = users.map(u => `
        <li class="conversation-item" onclick="loadChatHistory(${u.id})">
            ${u.username}
        </li>
    `).join('');
}

async function loadChatHistory(otherUserId) {
    activeChatUserId = otherUserId;

    // Update active class in list
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    // Note: To implement active class perfectly we'd need data attributes on li, keeping simple for now.

    const header = document.getElementById('chat-header');
    const messagesContainer = document.getElementById('chat-messages');
    const form = document.getElementById('chat-form');

    header.innerHTML = `<h3>Chatting with User #${otherUserId}</h3>`; // Ideally fetch name
    form.style.display = 'flex';

    const messages = await apiCall(`/messages.php?action=history&user_id=${otherUserId}`);

    messagesContainer.innerHTML = messages.map(m => {
        const isMe = m.sender_id == currentUser.id;
        return `
            <div class="message ${isMe ? 'message-sent' : 'message-received'}">
                <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 2px;">${isMe ? 'You' : m.sender_name}</div>
                ${m.content}
            </div>
        `;
    }).join('');

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}



// Orders Logic (Buyer)
// Orders Logic (Buyer)
async function loadOrders() {
    const tbody = document.getElementById('orders-body');
    if (!tbody) return;

    const orders = await apiCall('/orders.php');

    if (orders.error) {
        tbody.innerHTML = `<tr><td colspan="5">${orders.error}</td></tr>`;
        return;
    }

    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="5">No purchases yet.</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => {
        let statusBadge = '';
        let action = `<a href="chat.html?user_id=${o.seller_id}" class="btn btn-outline btn-sm">Contact Seller</a>`;

        if (o.shipping_status === 'shipped') {
            statusBadge = `<span class="badge" style="background: #e0f2fe; color: #0369a1;">Shipped</span>`;
            const shippedDate = o.shipped_at ? new Date(o.shipped_at).toLocaleDateString() : '';

            action += `
                <div style="margin-top: 5px;">
                    <button onclick="confirmOrderReceipt(${o.order_id})" class="btn btn-primary btn-sm">Order Received</button>
                    ${shippedDate ? `<div style="font-size: 0.75rem; margin-top: 2px;">Shipped on ${shippedDate}</div>` : ''}
                </div>
             `;
        } else if (o.shipping_status === 'received') {
            statusBadge = `<span class="badge" style="background: #dcfce7; color: #166534;">Received</span>`;
        } else {
            statusBadge = `<span class="badge" style="background: #f3f4f6; color: #4b5563;">To Ship</span>`;
        }

        return `
        <tr>
            <td>
                 <div style="display:flex; align-items:center; gap: 10px;">
                    <img src="${o.image_url || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">
                    <div>
                        <div>${o.title}</div>
                        <div style="font-size: 0.8rem; color: #666;">Qty: ${o.quantity || 1}</div>
                    </div>
                 </div>
            </td>
            <td>$${(parseFloat(o.price) * (o.quantity || 1)).toFixed(2)}</td>
            <td>${o.seller_name}</td>
            <td>${statusBadge}</td>
            <td>${action}</td>
        </tr>
    `}).join('');
}

window.confirmOrderReceipt = async function (orderId) {
    if (!confirm('Confirm that you have received this order?')) return;

    alert('Warning: If you confirm receipt but have not actually received the goods, the platform will not be responsible. Please ensure you have verified the package contents (video recording recommended).');

    if (!confirm('Are you absolutely sure you want to proceed?')) return;

    const res = await apiCall('/orders.php?action=confirm_receipt', 'POST', { order_id: orderId });

    if (res.success) {
        loadOrders();
    } else {
        alert(res.error || 'Failed to confirm receipt');
    }
};

function updateNav() {
    const navLinks = document.getElementById('nav-links');
    if (currentUser) {
        navLinks.innerHTML = `
            <span class="nav-link">Hi, ${currentUser.username}</span>
            <a href="dashboard.html" class="nav-link">Dashboard</a>
            <a href="cart.html" class="nav-link">Cart</a>
            <a href="orders.html" class="nav-link">My Orders</a>
            <a href="chat.html" class="nav-link">Messages</a>
            <a href="settings.html" class="nav-link">Settings</a>
            <a href="create_listing.html" class="btn btn-primary">Sell Item</a>
            <a href="#" onclick="logout(event)" class="nav-link">Logout</a>
        `;
    } else {
        navLinks.innerHTML = `
            <a href="login.html" class="nav-link">Login</a>
            <a href="register.html" class="btn btn-outline">Register</a>
        `;
    }
}

async function logout(e) {
    e.preventDefault();
    await apiCall('/auth.php?action=logout');
    window.location.href = 'index.html';
}

// --- Product Listing ---
async function loadProducts(query = '') {
    // Note: index.html now uses 'product-list' ID.
    // We check both for backward compatibility or strict migration.
    const list = document.getElementById('product-list') || document.getElementById('products-grid');
    if (!list) return;

    // Get Sort Value
    const sortSelect = document.getElementById('sort-select');
    const sort = sortSelect ? sortSelect.value : 'newest';

    let url = `/products.php?sort=${sort}`;
    if (query) {
        url += `&search=${encodeURIComponent(query)}`;
    }

    const products = await apiCall(url);
    if (!products) return;

    if (products.length === 0) {
        // list.className = 'row'; // No longer using row for empty state if we want consistent styling
        list.innerHTML = '<div class="col-12 text-center" style="grid-column: 1 / -1;"><p>No products found.</p></div>';
        return;
    }

    // Use products-grid class for styling
    list.className = 'products-grid';

    list.innerHTML = products.map(p => {
        const stock = p.is_unlimited ? '∞' : (p.quantity !== undefined ? p.quantity : 1);
        const soldQty = p.sold_quantity || 0;
        const totalQty = p.is_unlimited ? 999 : p.quantity;
        const available = p.is_unlimited ? 999 : (totalQty - soldQty);

        let soldBadge = '';
        if (soldQty > 0) {
            // Prominent Sold Count
            soldBadge = `<span class="badge bg-secondary" style="font-size: 0.9rem; margin-right: 0.5rem;">Sold: ${soldQty}</span>`;
        }

        let displayStock = p.is_unlimited ? 'Unlimited' : available;
        let stockHtml = '';

        if (available <= 0 && !p.is_unlimited) {
            stockHtml = '<span class="text-danger" style="font-weight:bold;">Sold Out</span>';
        } else {
            // Less prominent stock, with English label
            stockHtml = `<small class="text-muted">Stock: ${displayStock}</small>`;
        }

        return `
        <div class="product-card" onclick="window.location.href='product.html?id=${p.id}'">
            <img src="${p.image_url || 'https://via.placeholder.com/300'}" class="product-image" alt="${p.title}">
            <div class="product-info">
                <div class="d-flex justify-content-between align-items-start">
                    <h5 class="product-title" title="${p.title}">${p.title}</h5>
                    <span class="badge bg-primary" style="font-size: 0.9rem;">$${parseFloat(p.price).toFixed(2)}</span>
                </div>
                <p class="product-description">${p.description || ''}</p>
                <div class="product-meta" style="margin-top: auto; display: flex; flex-direction: column; gap: 4px;">
                     <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                        ${soldBadge}
                        ${stockHtml}
                     </div>
                     ${p.item_condition ? `<small style="color: #475569;">Condition: ${p.item_condition}</small>` : ''}
                     ${p.usage_duration ? `<small style="color: #475569;">Used: ${p.usage_duration}</small>` : ''}
                </div>
                <div style="font-size: 0.8rem; color: #888; margin-top: 0.25rem;">Seller: ${p.seller_name}</div>
            </div>
        </div>
    `}).join('');
}

// Search & Sort Listeners
document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');

    const handleSearch = () => {
        loadProducts(searchInput ? searchInput.value : '');
    };

    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', handleSearch);
    }
});

async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('form-error');

    const data = {
        username: form.username.value,
        email: form.email.value,
        password: form.password.value
    };

    const res = await apiCall('/auth.php?action=register', 'POST', data);

    if (res.success) {
        window.location.href = 'login.html';
    } else {
        errorEl.textContent = res.error || 'Registration failed';
        errorEl.style.display = 'block';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('form-error');

    const data = {
        username: form.username.value,
        password: form.password.value
    };

    const res = await apiCall('/auth.php?action=login', 'POST', data);

    if (res.success) {
        window.location.href = 'index.html';
    } else {
        errorEl.textContent = res.error || 'Login failed';
        errorEl.style.display = 'block';
    }
}

async function handleCreateListing(e) {
    e.preventDefault();
    const form = e.target;

    // Combine Usage Duration
    const years = document.getElementById('usage_years').value;
    const months = document.getElementById('usage_months').value;
    const days = document.getElementById('usage_days').value;
    let usageStr = '';

    if (years) usageStr += `${years} Year(s) `;
    if (months) usageStr += `${months} Month(s) `;
    if (days) usageStr += `${days} Day(s)`;

    // Calculate total days for sorting
    const totalDays = (parseInt(years || 0) * 365) + (parseInt(months || 0) * 30) + parseInt(days || 0);

    document.getElementById('usage_duration').value = usageStr.trim() || 'Not Specified';

    const formData = new FormData(form);
    formData.append('usage_days', totalDays);

    const res = await apiCall('/products.php', 'POST', formData);

    if (res.success) {
        window.location.href = 'index.html';
    } else {
        alert(res.error || 'Failed to list product');
    }
}

async function loadProductDetail() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;

    const container = document.getElementById('product-detail');
    const res = await apiCall(`/products.php?id=${id}`);

    if (res.error) {
        container.innerHTML = '<p>Product not found</p>';
        return;
    }

    const soldQty = res.sold_quantity || 0;
    const totalQty = res.quantity !== undefined ? res.quantity : 1;
    const stock = res.is_unlimited ? 99 : (totalQty - soldQty); // Available stock

    const isSold = !res.is_unlimited && stock <= 0;
    const maxAttr = res.is_unlimited ? '' : `max="${stock}"`;

    // Initialize actionButtons
    let actionButtons = '';

    const quantitySelector = !isSold && (!currentUser || currentUser.id !== res.seller_id) ? `
        <div style="margin-top: 1rem; margin-bottom: 0.5rem;">
            <label for="purchase-quantity" style="font-weight: 500;">Quantity:</label>
            <input type="number" id="purchase-quantity" value="1" min="1" ${maxAttr} style="width: 60px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
        </div>
    ` : '';

    if (!isSold) {
        if (currentUser && currentUser.id !== res.seller_id) {
            actionButtons = `
                ${quantitySelector}
                <button onclick="addToCart(${res.id}, document.getElementById('purchase-quantity').value)" class="btn btn-outline" style="width: 100%; margin-top: 0.5rem;">Add to Cart</button>
                <button onclick="buyProduct(${res.id}, document.getElementById('purchase-quantity').value)" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">Buy Now</button>
                <a href="chat.html?user_id=${res.seller_id}" class="btn btn-outline" style="width: 100%; margin-top: 0.5rem; text-align: center;">Contact Seller</a>
            `;
        }
    } else {
        actionButtons = '<div class="badge badge-sold">SOLD</div>';
    }

    container.innerHTML = `
        <img src="${res.image_url || 'https://via.placeholder.com/500?text=No+Image'}" class="detail-image" alt="${res.title}">
        <div class="detail-info">
            <h1>${res.title}</h1>
            <div class="detail-price">$${parseFloat(res.price).toFixed(2)}</div>
            <p class="detail-description">${res.description || 'No description available.'}</p>
            <div class="meta">
                <p>Seller: <strong>${res.seller_name}</strong></p>
                <p>Posted: ${new Date(res.created_at).toLocaleDateString()}</p>
                <p>Stock: ${res.is_unlimited ? '∞' : stock}</p>
                ${res.item_condition ? `<p>Condition: <strong>${res.item_condition}</strong></p>` : ''}
                ${res.usage_duration ? `<p>Used For: <strong>${res.usage_duration}</strong></p>` : ''}
            </div>
            ${actionButtons}
        </div>
    `;
}

async function buyProduct(id, quantity = 1) {
    if (!confirm(`Are you sure you want to buy ${quantity} item(s)?`)) return;

    // Try direct buy first (which will use saved address)
    // If it fails with MISSING_ADDRESS, redirect to settings
    // If it succeeds, great.
    // However, if we want to let them Edit address, we should go to Cart, OR show a modal.
    // The user said: "If no address info when buying, jump to that page".
    // So let's try to buy directly. If backend says missing address, jump.

    // BUT, wait, the "Buy Now" flow was recently changed (in previous turn) to redirect to Cart. 
    // The user COMPLAINED "In product page direct buy also doesn't work".
    // This implies they expect it to work or at least do something useful. 
    // If we redirect to Cart, they see the form. This is good. 
    // Maybe the user's issue is they didn't see the form or it was buggy?
    // "Buy now" -> Adds to cart -> Goes to cart.
    // If the user wants "Direct Buy" without cart step, we need the old logic back but with address check.
    // Let's support TRUE Buy Now (one-click like) if address exists.

    // Let's try the 'buy_now' action again, which I kept in cart.php but frontend wasn't using.

    const res = await apiCall('/cart.php?action=buy_now', 'POST', {
        product_id: id,
        quantity: quantity
        // No shipping info sent here, so backend will look up DB
    });

    if (res.success) {
        alert('Purchase successful!');
        window.location.reload();
    } else {
        if (res.error === 'MISSING_ADDRESS') {
            const details = res.details ? `\n(${res.details})` : '';
            if (confirm(`You have no shipping address saved.${details}\n\nPlease set your address in Settings to proceed.`)) {
                window.location.href = 'settings.html';
            }
        } else {
            // If other error, maybe standard alert
            alert(res.error || 'Purchase failed');
        }
    }
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();

    if (document.getElementById('product-list') || document.getElementById('products-grid')) loadProducts();
    if (document.getElementById('register-form')) document.getElementById('register-form').addEventListener('submit', handleRegister);
    if (document.getElementById('login-form')) document.getElementById('login-form').addEventListener('submit', handleLogin);
    if (document.getElementById('create-listing-form')) document.getElementById('create-listing-form').addEventListener('submit', handleCreateListing);
    if (document.getElementById('product-detail')) loadProductDetail();
    if (document.getElementById('cart-items')) loadCart();
});


