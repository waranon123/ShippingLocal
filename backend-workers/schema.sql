-- D1 Database Schema for Truck Management System
-- Drop existing tables if they exist
DROP TABLE IF EXISTS trucks;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Trucks table
CREATE TABLE trucks (
    id TEXT PRIMARY KEY,
    terminal TEXT NOT NULL,
    shipping_no TEXT NOT NULL,
    dock_code TEXT NOT NULL,
    truck_route TEXT NOT NULL,
    preparation_start TEXT,
    preparation_end TEXT,
    loading_start TEXT,
    loading_end TEXT,
    status_preparation TEXT DEFAULT 'On Process',
    status_loading TEXT DEFAULT 'On Process',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trucks_terminal ON trucks(terminal);
CREATE INDEX IF NOT EXISTS idx_trucks_shipping_date ON trucks(shipping_no, created_at);
CREATE INDEX IF NOT EXISTS idx_trucks_status_date ON trucks(status_preparation, status_loading, created_at);
CREATE INDEX IF NOT EXISTS idx_trucks_created_at ON trucks(created_at);

-- Insert default admin user (password: admin123)
INSERT INTO users (id, username, password_hash, role, created_at) 
VALUES (
    'admin-default-id',
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LNBu.aK5nR7dJ8fY.e',
    'admin',
    CURRENT_TIMESTAMP
);

-- Insert demo users
INSERT INTO users (id, username, password_hash, role, created_at) 
VALUES 
(
    'user-demo-id',
    'user',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LNBu.bL6oS8eK9gZ.f',
    'user',
    CURRENT_TIMESTAMP
),
(
    'viewer-demo-id', 
    'viewer',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LNBu.cM7pT9fL0hA.g',
    'viewer',
    CURRENT_TIMESTAMP
);

-- Insert sample truck data for testing
INSERT INTO trucks (
    id, terminal, shipping_no, dock_code, truck_route,
    preparation_start, preparation_end, loading_start, loading_end,
    status_preparation, status_loading, created_at, updated_at
) VALUES 
(
    'truck-sample-1',
    'A',
    'SHP001',
    'DOCK-A1', 
    'Bangkok-Chonburi',
    '08:00',
    '08:30',
    '09:00',
    '10:00',
    'Finished',
    'Finished',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'truck-sample-2',
    'B',
    'SHP002',
    'DOCK-B1',
    'Bangkok-Rayong', 
    '09:00',
    '09:30',
    '10:00',
    null,
    'Finished',
    'On Process',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'truck-sample-3',
    'C',
    'SHP003',
    'DOCK-C1',
    'Bangkok-Pattaya',
    '10:00',
    null,
    null,
    null,
    'On Process',
    'On Process',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'truck-sample-4',
    'A',
    'SHP004',
    'DOCK-A2',
    'Bangkok-Samut Prakan',
    '11:00',
    '11:15',
    '12:00',
    '12:45',
    'Finished',
    'Finished',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'truck-sample-5',
    'B',
    'SHP005',
    'DOCK-B2',
    'Bangkok-Nonthaburi',
    '14:00',
    null,
    null,
    null,
    'Delay',
    'On Process',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);