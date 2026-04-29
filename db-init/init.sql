-- 1. The Master User Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'agent', 'admin'))
);

-- 2. The Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',

    -- Foreign Key: Points to the user who created it
    created_by INT REFERENCES users(id) ON DELETE CASCADE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. The Support Assignments Table
CREATE TABLE IF NOT EXISTS support_assignments (
    id SERIAL PRIMARY KEY,

    -- Foreign Key: Points to the specific ticket
    ticket_id INT REFERENCES tickets(id) ON DELETE CASCADE,

    -- Foreign Key: Points to the specific agent (who is also a user)
    agent_id INT REFERENCES users(id) ON DELETE SET NULL,

    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolution_notes TEXT
);

-- 4. table for the Notification Service (History)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    -- Added the Reference constraint
    user_id INT REFERENCES users(id) ON DELETE CASCADE,

    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

