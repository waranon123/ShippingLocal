# backend/create_demo_users.py
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models import User, SessionLocal, get_password_hash
import uuid

def create_demo_users():
    """Create demo users for testing"""
    db = SessionLocal()
    
    try:
        # Demo users data
        demo_users = [
            {
                "username": "user",
                "password": "user123", 
                "role": "user"
            },
            {
                "username": "viewer",
                "password": "viewer123",
                "role": "viewer"
            },
            {
                "username": "manager",
                "password": "manager123",
                "role": "admin"
            }
        ]
        
        created_count = 0
        
        for user_data in demo_users:
            # Check if user already exists
            existing_user = db.query(User).filter(User.username == user_data["username"]).first()
            
            if not existing_user:
                # Create new user
                new_user = User(
                    id=str(uuid.uuid4()),
                    username=user_data["username"],
                    password_hash=get_password_hash(user_data["password"]),
                    role=user_data["role"]
                )
                
                db.add(new_user)
                created_count += 1
                print(f"✅ Created user: {user_data['username']} ({user_data['role']})")
            else:
                print(f"⚠️  User already exists: {user_data['username']}")
        
        db.commit()
        
        print(f"\n🎉 Demo users setup complete!")
        print(f"Created {created_count} new users")
        print("\n📋 Available demo accounts:")
        print("👤 Admin: admin / admin123")
        print("👤 User: user / user123") 
        print("👤 Viewer: viewer / viewer123")
        print("👤 Manager: manager / manager123")
        print("\n🚀 You can now test different permission levels!")
        
    except Exception as e:
        print(f"❌ Error creating demo users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_demo_users()