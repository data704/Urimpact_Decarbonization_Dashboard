-- Initialize URIMPACT Database
-- This script runs automatically when PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE urimpact TO urimpact;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'URIMPACT database initialized successfully!';
END $$;
