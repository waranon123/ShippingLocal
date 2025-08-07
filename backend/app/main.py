import pandas as pd
from fastapi import UploadFile, File, Response, FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, func  # Add func import here
from typing import List, Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
import os
from dotenv import load_dotenv
import json
import uuid
import io
import xlsxwriter
import math
from calendar import monthrange
from datetime import datetime, date
from .models import Truck, User, create_tables, get_db
from .schemas import TruckCreate, TruckUpdate, Token, UserResponse, Truck as TruckSchema

# Load environment variables
load_dotenv()

# Create tables on startup
create_tables()

app = FastAPI(title="Truck Management System API - Local Database")

# CORS - Updated for tunnel services
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://*.vercel.app",
        "https://*.ngrok-free.app",  # Ngrok domains
        "https://*.ngrok.io",        # Legacy ngrok
        "https://*.loca.lt",         # LocalTunnel
        "https://*.localhost.run",   # Alternative tunnel
        "*"  # Allow all for development (remove in production)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key-for-dev")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_MINUTES = int(os.getenv("JWT_EXPIRATION_MINUTES", "60"))

# Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key-for-dev")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_MINUTES = int(os.getenv("JWT_EXPIRATION_MINUTES", "60"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                pass

manager = ConnectionManager()
import_sessions = {}

# Helper function to clean data for JSON serialization
def clean_for_json(data):
    """Clean data to make it JSON compliant"""
    if isinstance(data, dict):
        return {k: clean_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_for_json(item) for item in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
        return data
    elif pd.isna(data):
        return None
    else:
        return data

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role", "viewer")
        is_guest: bool = payload.get("is_guest", False)
        
        if username is None:
            raise credentials_exception
            
        # Handle guest user
        if is_guest and username == "guest_viewer":
            return UserResponse(id="guest", username="Guest Viewer", role="viewer")
        
        # Handle regular user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise credentials_exception
        
        return UserResponse(id=user.id, username=user.username, role=user.role)
        
    except JWTError:
        raise credentials_exception

def check_permission(required_role: str):
    def permission_checker(current_user: UserResponse = Depends(get_current_user)):
        role_hierarchy = {"viewer": 0, "user": 1, "admin": 2}
        if role_hierarchy.get(current_user.role, 0) < role_hierarchy.get(required_role, 0):
            raise HTTPException(
                status_code=403,
                detail="Not enough permissions"
            )
        return current_user
    return permission_checker

# Initialize default admin user
def init_default_user():
    from .models import SessionLocal
    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.username == "admin").first()
        if not existing_user:
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("admin123"),
                role="admin"
            )
            db.add(admin_user)
            db.commit()
            print("✅ Default admin user created (admin/admin123)")
    except Exception as e:
        print(f"❌ Error creating default user: {e}")
    finally:
        db.close()

# Call init function
from .models import SessionLocal
init_default_user()

# Routes
@app.get("/")
def read_root():
    return {
        "message": "Truck Management System API - Local Database",
        "version": "2.0.0",
        "database": "SQLite Local",
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "auth": "/api/auth/login",
            "trucks": "/api/trucks",
            "stats": "/api/stats",
            "websocket": "/ws"
        },
        "default_login": {
            "username": "admin",
            "password": "admin123"
        }
    }


@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        truck_count = db.query(Truck).count()
        return {
            "status": "healthy",
            "database": "connected",
            "truck_count": truck_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=JWT_EXPIRATION_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role
    }


@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=JWT_EXPIRATION_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role
    }

# Add user registration endpoint
@app.post("/api/auth/register")
async def register_user(
    username: str,
    password: str,
    role: str = "user",
    current_user: UserResponse = Depends(check_permission("admin")),
    db: Session = Depends(get_db)
):
    """Register new user (admin only)"""
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Validate role
        valid_roles = ["viewer", "user", "admin"]
        if role not in valid_roles:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        # Create new user
        new_user = User(
            id=str(uuid.uuid4()),
            username=username,
            password_hash=get_password_hash(password),
            role=role
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return {
            "success": True,
            "message": f"User '{username}' created successfully",
            "user": {
                "id": new_user.id,
                "username": new_user.username,
                "role": new_user.role
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

# Add guest login endpoint
@app.post("/api/auth/guest-login", response_model=Token)
async def guest_login():
    """Login as guest viewer (no authentication required)"""
    try:
        # Create temporary guest token
        guest_data = {
            "sub": "guest_viewer",
            "role": "viewer",
            "is_guest": True
        }
        
        access_token_expires = timedelta(minutes=JWT_EXPIRATION_MINUTES)
        access_token = create_access_token(
            data=guest_data,
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": "viewer"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Guest login failed: {str(e)}")


# Update get_current_user to handle guest tokens
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role", "viewer")
        is_guest: bool = payload.get("is_guest", False)
        
        if username is None:
            raise credentials_exception
            
        # Handle guest user
        if is_guest and username == "guest_viewer":
            return UserResponse(id="guest", username="Guest Viewer", role="viewer")
        
        # Handle regular user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise credentials_exception
        
        return UserResponse(id=user.id, username=user.username, role=user.role)
        
    except JWTError:
        raise credentials_exception

# Add users management endpoints
@app.get("/api/users")
async def get_users(
    current_user: UserResponse = Depends(check_permission("admin")),
    db: Session = Depends(get_db)
):
    """Get all users (admin only)"""
    users = db.query(User).all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "created_at": user.created_at.isoformat()
        }
        for user in users
    ]

@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: UserResponse = Depends(check_permission("admin")),
    db: Session = Depends(get_db)
):
    """Delete user (admin only)"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    
    return {"message": f"User '{user.username}' deleted successfully"}

@app.get("/api/trucks", response_model=List[TruckSchema])
async def get_trucks(
    skip: int = 0,
    limit: int = 100,
    terminal: Optional[str] = None,
    status_preparation: Optional[str] = None,
    status_loading: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Truck)
    
    if terminal:
        query = query.filter(Truck.terminal == terminal)
    if status_preparation:
        query = query.filter(Truck.status_preparation == status_preparation)
    if status_loading:
        query = query.filter(Truck.status_loading == status_loading)
    if date_from:
        date_from_dt = f"{date_from} 00:00:00"
        query = query.filter(Truck.created_at >= date_from_dt)
    if date_to:
        date_to_dt = f"{date_to} 23:59:59"
        query = query.filter(Truck.created_at <= date_to_dt)
    
    trucks = query.order_by(Truck.created_at.desc()).offset(skip).limit(limit).all()
    
    # Clean trucks data for JSON response
    trucks_data = []
    for truck in trucks:
        truck_dict = {
            "id": truck.id,
            "terminal": truck.terminal,
            "shipping_no": truck.shipping_no,
            "dock_code": truck.dock_code,
            "truck_route": truck.truck_route,
            "preparation_start": truck.preparation_start,
            "preparation_end": truck.preparation_end,
            "loading_start": truck.loading_start,
            "loading_end": truck.loading_end,
            "status_preparation": truck.status_preparation,
            "status_loading": truck.status_loading,
            "created_at": truck.created_at.isoformat(),
            "updated_at": truck.updated_at.isoformat() if truck.updated_at else None
        }
        trucks_data.append(clean_for_json(truck_dict))
    
    return trucks_data

@app.get("/api/stats")
async def get_stats(
    terminal: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"📊 API Request - get_stats with params:")
    print(f"   terminal: {terminal}")
    print(f"   date_from: {date_from}")
    print(f"   date_to: {date_to}")
    
    try:
        query = db.query(Truck)
        
        if terminal:
            query = query.filter(Truck.terminal == terminal)
            print(f"   Applied terminal filter: {terminal}")
        
        # Enhanced date filtering (same as get_trucks)
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                from_datetime = from_date.replace(hour=0, minute=0, second=0, microsecond=0)
                query = query.filter(Truck.created_at >= from_datetime)
                print(f"   Applied date_from filter: {from_datetime}")
            except ValueError as e:
                print(f"   ❌ Invalid date_from format: {date_from}, error: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid date_from format. Use YYYY-MM-DD. Got: {date_from}")
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                to_datetime = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                query = query.filter(Truck.created_at <= to_datetime)
                print(f"   Applied date_to filter: {to_datetime}")
            except ValueError as e:
                print(f"   ❌ Invalid date_to format: {date_to}, error: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid date_to format. Use YYYY-MM-DD. Got: {date_to}")
        
        trucks = query.all()
        print(f"   Found {len(trucks)} total records for stats")
        
        # Calculate statistics
        total_trucks = len(trucks)
        preparation_stats = {"On Process": 0, "Delay": 0, "Finished": 0}
        loading_stats = {"On Process": 0, "Delay": 0, "Finished": 0}
        terminal_stats = {}
        
        for truck in trucks:
            # Preparation stats
            prep_status = truck.status_preparation or "On Process"
            if prep_status in preparation_stats:
                preparation_stats[prep_status] += 1
            
            # Loading stats
            load_status = truck.status_loading or "On Process"
            if load_status in loading_stats:
                loading_stats[load_status] += 1
            
            # Terminal stats
            term = truck.terminal or "Unknown"
            terminal_stats[term] = terminal_stats.get(term, 0) + 1
        
        stats_result = {
            "total_trucks": total_trucks,
            "preparation_stats": preparation_stats,
            "loading_stats": loading_stats,
            "terminal_stats": terminal_stats
        }
        
        print(f"   ✅ Stats calculated: {stats_result}")
        return clean_for_json(stats_result)
    
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"   ❌ Unexpected error in get_stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/api/trucks", response_model=List[TruckSchema])
async def get_trucks(
    skip: int = 0,
    limit: int = 100,
    terminal: Optional[str] = None,
    status_preparation: Optional[str] = None,
    status_loading: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"🔍 API Request - get_trucks with params:")
    print(f"   skip: {skip}, limit: {limit}")
    print(f"   terminal: {terminal}")
    print(f"   status_preparation: {status_preparation}")
    print(f"   status_loading: {status_loading}")
    print(f"   date_from: {date_from}")
    print(f"   date_to: {date_to}")
    
    try:
        query = db.query(Truck)
        
        # Apply filters
        if terminal:
            query = query.filter(Truck.terminal == terminal)
            print(f"   Applied terminal filter: {terminal}")
        
        if status_preparation:
            query = query.filter(Truck.status_preparation == status_preparation)
            print(f"   Applied prep status filter: {status_preparation}")
            
        if status_loading:
            query = query.filter(Truck.status_loading == status_loading)
            print(f"   Applied loading status filter: {status_loading}")
        
        # Enhanced date filtering
        if date_from:
            try:
                # Parse date_from and set to start of day
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                from_datetime = from_date.replace(hour=0, minute=0, second=0, microsecond=0)
                query = query.filter(Truck.created_at >= from_datetime)
                print(f"   Applied date_from filter: {from_datetime}")
            except ValueError as e:
                print(f"   ❌ Invalid date_from format: {date_from}, error: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid date_from format. Use YYYY-MM-DD. Got: {date_from}")
        
        if date_to:
            try:
                # Parse date_to and set to end of day
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                to_datetime = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                query = query.filter(Truck.created_at <= to_datetime)
                print(f"   Applied date_to filter: {to_datetime}")
            except ValueError as e:
                print(f"   ❌ Invalid date_to format: {date_to}, error: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid date_to format. Use YYYY-MM-DD. Got: {date_to}")
        
        # Get total count before pagination for debugging
        total_count = query.count()
        print(f"   Total records matching filters: {total_count}")
        
        # Apply ordering and pagination
        trucks = query.order_by(Truck.created_at.desc()).offset(skip).limit(limit).all()
        print(f"   Retrieved {len(trucks)} records after pagination")
        
        # Clean trucks data for JSON response
        trucks_data = []
        for truck in trucks:
            truck_dict = {
                "id": truck.id,
                "terminal": truck.terminal,
                "shipping_no": truck.shipping_no,
                "dock_code": truck.dock_code,
                "truck_route": truck.truck_route,
                "preparation_start": truck.preparation_start,
                "preparation_end": truck.preparation_end,
                "loading_start": truck.loading_start,
                "loading_end": truck.loading_end,
                "status_preparation": truck.status_preparation,
                "status_loading": truck.status_loading,
                "created_at": truck.created_at.isoformat(),
                "updated_at": truck.updated_at.isoformat() if truck.updated_at else None
            }
            trucks_data.append(clean_for_json(truck_dict))
        
        print(f"   ✅ Returning {len(trucks_data)} cleaned records")
        
        # Log sample data for debugging
        if trucks_data:
            print(f"   Sample record: {trucks_data[0]}")
        
        return trucks_data
    
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"   ❌ Unexpected error in get_trucks: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/trucks/template")
async def download_import_template():
    template_data = {
        'Month': ['2024-01', '2024-02', '2024-03'],  # New Month column
        'Terminal': ['A', 'B', 'C'],
        'Shipping No': ['SHP001', 'SHP002', 'SHP003'],
        'Dock Code': ['DOCK-A1', 'DOCK-B1', 'DOCK-C1'],
        'Route': ['Bangkok-Chonburi', 'Bangkok-Rayong', 'Bangkok-Pattaya'],
        'Prep Start': ['08:00', '09:00', '10:00'],
        'Prep End': ['08:30', '09:30', ''],
        'Load Start': ['09:00', '10:00', ''],
        'Load End': ['10:00', '', ''],
        'Status Prep': ['Finished', 'Finished', 'On Process'],
        'Status Load': ['Finished', 'On Process', 'On Process']
    }
    
    df = pd.DataFrame(template_data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Template', index=False)
        workbook = writer.book
        worksheet = writer.sheets['Template']
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#2196F3',
            'font_color': 'white',
            'border': 1,
            'align': 'center'
        })
        instructions = workbook.add_worksheet('Instructions')
        instructions.write('A1', 'Monthly Import Instructions:', workbook.add_format({'bold': True, 'size': 14}))
        instructions.write('A3', '1. Fill in the Template sheet with your monthly truck data')
        instructions.write('A4', '2. Required fields: Month (YYYY-MM), Terminal, Shipping No, Dock Code, Route')
        instructions.write('A5', '3. Month format: 2024-01 (will create records for all days in January 2024)')
        instructions.write('A6', '4. Optional fields: Time fields and Status fields')
        instructions.write('A7', '5. Valid status values: "On Process", "Delay", "Finished"')
        instructions.write('A8', '6. Time format: HH:MM (24-hour format)')
        instructions.write('A9', '7. Each row will create daily records for the entire month')
        instructions.write('A10', '8. Save the file and upload through the Management page')
        
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
        
        # Set column widths
        worksheet.set_column('A:A', 12)  # Month
        worksheet.set_column('B:B', 12)  # Terminal
        worksheet.set_column('C:C', 12)  # Shipping No
        worksheet.set_column('D:D', 12)  # Dock Code
        worksheet.set_column('E:E', 20)  # Route
        worksheet.set_column('F:F', 12)  # Prep Start
        worksheet.set_column('G:G', 12)  # Prep End
        worksheet.set_column('H:H', 12)  # Load Start
        worksheet.set_column('I:I', 12)  # Load End
        worksheet.set_column('J:J', 12)  # Status Prep
        worksheet.set_column('K:K', 12)  # Status Load
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=truck_monthly_import_template.xlsx'}
    )

# Update the preview import endpoint
@app.post("/api/trucks/import/preview")
async def preview_excel_import(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(check_permission("user"))
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "File must be Excel format (.xlsx or .xls)")
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        required_columns = {
            'Month': 'month',
            'Terminal': 'terminal',
            'Shipping No': 'shipping_no',
            'Dock Code': 'dock_code',
            'Route': 'truck_route'
        }
        
        missing_cols = [col for col in required_columns.keys() if col not in df.columns]
        if missing_cols:
            raise HTTPException(400, f"Missing required columns: {', '.join(missing_cols)}")
        
        optional_columns = {
            'Prep Start': 'preparation_start',
            'Prep End': 'preparation_end',
            'Load Start': 'loading_start',
            'Load End': 'loading_end',
            'Status Prep': 'status_preparation',
            'Status Load': 'status_loading'
        }
        
        trucks_preview = []
        errors = []
        total_records_to_create = 0
        
        for index, row in df.iterrows():
            try:
                truck_template = {}
                
                # Validate and parse month
                month_str = row.get('Month', '')
                if pd.isna(month_str) or str(month_str).strip() == '':
                    errors.append(f"Row {index + 2}: Month is required")
                    continue
                
                try:
                    year, month = str(month_str).strip().split('-')
                    year = int(year)
                    month = int(month)
                    if month < 1 or month > 12:
                        raise ValueError("Invalid month")
                    truck_template['year'] = year
                    truck_template['month'] = month
                    
                    # Calculate days in month
                    days_in_month = monthrange(year, month)[1]
                    total_records_to_create += days_in_month
                    
                except (ValueError, IndexError):
                    errors.append(f"Row {index + 2}: Month must be in format YYYY-MM (e.g., 2024-01)")
                    continue
                
                # Process required columns
                for excel_col, db_col in required_columns.items():
                    if excel_col == 'Month':
                        continue  # Already processed
                    value = row.get(excel_col, '')
                    if pd.isna(value) or str(value).strip() == '':
                        errors.append(f"Row {index + 2}: {excel_col} is required")
                        continue
                    truck_template[db_col] = str(value).strip()
                
                # Process optional columns
                for excel_col, db_col in optional_columns.items():
                    if excel_col in df.columns:
                        value = row.get(excel_col)
                        if not pd.isna(value):
                            if 'start' in db_col or 'end' in db_col:
                                try:
                                    if isinstance(value, datetime):
                                        truck_template[db_col] = value.strftime('%H:%M')
                                    else:
                                        truck_template[db_col] = str(value)
                                except:
                                    truck_template[db_col] = str(value)
                            else:
                                truck_template[db_col] = str(value)
                        else:
                            truck_template[db_col] = None
                
                # Set default statuses
                if 'status_preparation' not in truck_template:
                    truck_template['status_preparation'] = 'On Process'
                if 'status_loading' not in truck_template:
                    truck_template['status_loading'] = 'On Process'
                
                # Validate statuses
                valid_statuses = ['On Process', 'Delay', 'Finished']
                if truck_template.get('status_preparation') not in valid_statuses:
                    truck_template['status_preparation'] = 'On Process'
                if truck_template.get('status_loading') not in valid_statuses:
                    truck_template['status_loading'] = 'On Process'
                
                # Add sample preview (just show the template for preview)
                preview_truck = truck_template.copy()
                preview_truck['preview_days'] = days_in_month
                trucks_preview.append(preview_truck)
                
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        session_id = str(uuid.uuid4())
        import_sessions[session_id] = {
            'truck_templates': trucks_preview,
            'user_id': current_user.id,
            'timestamp': datetime.utcnow(),
            'total_records_to_create': total_records_to_create
        }
        
        return clean_for_json({
            "success": True,
            "session_id": session_id,
            "preview": trucks_preview[:10],
            "total_templates": len(trucks_preview),
            "total_records_to_create": total_records_to_create,
            "errors": errors,
            "columns_found": list(df.columns),
            "message": f"Will create {total_records_to_create} daily records from {len(trucks_preview)} monthly templates"
        })
        
    except Exception as e:
        raise HTTPException(400, f"Error reading Excel file: {str(e)}")

# Update the confirm import endpoint
# Updated confirm import endpoint with fixed func import
@app.post("/api/trucks/import/confirm")
async def confirm_excel_import(
    data: dict,
    current_user: UserResponse = Depends(check_permission("user")),
    db: Session = Depends(get_db)
):
    session_id = data.get('session_id')
    session = import_sessions.get(session_id)
    if not session:
        raise HTTPException(400, "Import session not found or expired")
    
    if session['user_id'] != current_user.id:
        raise HTTPException(403, "Unauthorized")
    
    truck_templates = session['truck_templates']
    imported_count = 0
    failed_imports = []
    
    try:
        for template_index, truck_template in enumerate(truck_templates):
            try:
                year = truck_template['year']
                month = truck_template['month']
                days_in_month = monthrange(year, month)[1]
                
                # Create a record for each day of the month
                for day in range(1, days_in_month + 1):
                    try:
                        # Create unique shipping_no for each day
                        base_shipping_no = truck_template['shipping_no']
                        daily_shipping_no = f"{base_shipping_no}_{year:04d}{month:02d}{day:02d}"
                        
                        # Check if record already exists for this date
                        record_date = date(year, month, day)
                        
                        # Fixed: Use func imported from sqlalchemy
                        existing = db.query(Truck).filter(
                            and_(
                                Truck.shipping_no == daily_shipping_no,
                                func.date(Truck.created_at) == record_date  # Fixed: Use func here
                            )
                        ).first()
                        
                        if existing:
                            # Update existing record
                            for key, value in truck_template.items():
                                if key not in ['year', 'month', 'preview_days']:
                                    if key == 'shipping_no':
                                        setattr(existing, key, daily_shipping_no)
                                    else:
                                        setattr(existing, key, value)
                            existing.updated_at = datetime.utcnow()
                            created_truck = existing
                        else:
                            # Create new record
                            truck_data = {}
                            for key, value in truck_template.items():
                                if key not in ['year', 'month', 'preview_days']:
                                    if key == 'shipping_no':
                                        truck_data[key] = daily_shipping_no
                                    else:
                                        truck_data[key] = value
                            
                            db_truck = Truck(**truck_data)
                            db_truck.id = str(uuid.uuid4())
                            db_truck.created_at = datetime.combine(record_date, datetime.min.time())
                            db.add(db_truck)
                            created_truck = db_truck
                        
                        db.commit()
                        db.refresh(created_truck)
                        imported_count += 1
                        
                        # Broadcast only for today's records to avoid spam
                        if record_date == date.today():
                            await manager.broadcast({
                                "type": "truck_created",
                                "data": {
                                    "id": created_truck.id,
                                    "terminal": created_truck.terminal,
                                    "shipping_no": created_truck.shipping_no,
                                    "dock_code": created_truck.dock_code,
                                    "truck_route": created_truck.truck_route,
                                    "preparation_start": created_truck.preparation_start,
                                    "preparation_end": created_truck.preparation_end,
                                    "loading_start": created_truck.loading_start,
                                    "loading_end": created_truck.loading_end,
                                    "status_preparation": created_truck.status_preparation,
                                    "status_loading": created_truck.status_loading,
                                    "created_at": created_truck.created_at.isoformat(),
                                    "updated_at": created_truck.updated_at.isoformat() if created_truck.updated_at else None
                                }
                            })
                            
                    except Exception as day_error:
                        print(f"❌ Day error for template {template_index + 1}, day {day}: {str(day_error)}")
                        failed_imports.append({
                            "template": template_index + 1,
                            "day": day,
                            "shipping_no": f"{truck_template.get('shipping_no', 'Unknown')}_{year:04d}{month:02d}{day:02d}",
                            "error": str(day_error)
                        })
                        db.rollback()  # Rollback failed transaction
                        
            except Exception as template_error:
                print(f"❌ Template error for template {template_index + 1}: {str(template_error)}")
                failed_imports.append({
                    "template": template_index + 1,
                    "shipping_no": truck_template.get('shipping_no', 'Unknown'),
                    "error": str(template_error)
                })
        
        # Clean up session
        if session_id in import_sessions:
            del import_sessions[session_id]
        
        print(f"✅ Import completed: {imported_count} imported, {len(failed_imports)} failed")
        
        return clean_for_json({
            "success": True,
            "imported": imported_count,
            "failed": len(failed_imports),
            "failed_details": failed_imports,
            "message": f"Successfully imported {imported_count} daily records from monthly templates"
        })
        
    except Exception as e:
        print(f"❌ Import exception: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Clean up session on error
        if session_id in import_sessions:
            del import_sessions[session_id]
            
        raise HTTPException(500, f"Import failed: {str(e)}")
    
@app.get("/api/trucks/{truck_id}")
async def get_truck(
    truck_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    truck_data = {
        "id": truck.id,
        "terminal": truck.terminal,
        "shipping_no": truck.shipping_no,
        "dock_code": truck.dock_code,
        "truck_route": truck.truck_route,
        "preparation_start": truck.preparation_start,
        "preparation_end": truck.preparation_end,
        "loading_start": truck.loading_start,
        "loading_end": truck.loading_end,
        "status_preparation": truck.status_preparation,
        "status_loading": truck.status_loading,
        "created_at": truck.created_at.isoformat(),
        "updated_at": truck.updated_at.isoformat() if truck.updated_at else None
    }
    
    return clean_for_json(truck_data)

@app.put("/api/trucks/{truck_id}", response_model=TruckSchema)
async def update_truck(
    truck_id: str,
    truck: TruckUpdate,
    current_user: UserResponse = Depends(check_permission("user")),
    db: Session = Depends(get_db)
):
    db_truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not db_truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    update_data = truck.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_truck, key, value)
    
    db_truck.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_truck)
    
    await manager.broadcast({
        "type": "truck_updated",
        "data": {
            "id": db_truck.id,
            "terminal": db_truck.terminal,
            "shipping_no": db_truck.shipping_no,
            "dock_code": db_truck.dock_code,
            "truck_route": db_truck.truck_route,
            "preparation_start": db_truck.preparation_start,
            "preparation_end": db_truck.preparation_end,
            "loading_start": db_truck.loading_start,
            "loading_end": db_truck.loading_end,
            "status_preparation": db_truck.status_preparation,
            "status_loading": db_truck.status_loading,
            "created_at": db_truck.created_at.isoformat(),
            "updated_at": db_truck.updated_at.isoformat() if db_truck.updated_at else None
        }
    })
    
    return db_truck

@app.delete("/api/trucks/{truck_id}")
async def delete_truck(
    truck_id: str,
    current_user: UserResponse = Depends(check_permission("admin")),
    db: Session = Depends(get_db)
):
    db_truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not db_truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    db.delete(db_truck)
    db.commit()
    
    await manager.broadcast({
        "type": "truck_deleted",
        "data": {"id": truck_id}
    })
    
    return {"message": "Truck deleted successfully"}

@app.patch("/api/trucks/{truck_id}/status")
async def update_truck_status(
    truck_id: str,
    status_type: str,
    status: str,
    current_user: UserResponse = Depends(check_permission("user")),
    db: Session = Depends(get_db)
):
    if status_type not in ["preparation", "loading"]:
        raise HTTPException(status_code=400, detail="Invalid status type")
    
    if status not in ["On Process", "Delay", "Finished"]:
        raise HTTPException(status_code=400, detail="Invalid status value")
    
    db_truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not db_truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    if status_type == "preparation":
        db_truck.status_preparation = status
    else:
        db_truck.status_loading = status
    
    db_truck.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_truck)
    
    await manager.broadcast({
        "type": "status_updated",
        "data": {
            "id": db_truck.id,
            "terminal": db_truck.terminal,
            "shipping_no": db_truck.shipping_no,
            "dock_code": db_truck.dock_code,
            "truck_route": db_truck.truck_route,
            "preparation_start": db_truck.preparation_start,
            "preparation_end": db_truck.preparation_end,
            "loading_start": db_truck.loading_start,
            "loading_end": db_truck.loading_end,
            "status_preparation": db_truck.status_preparation,
            "status_loading": db_truck.status_loading,
            "created_at": db_truck.created_at.isoformat(),
            "updated_at": db_truck.updated_at.isoformat() if db_truck.updated_at else None
        }
    })
    
    return db_truck
@app.get("/api/debug/trucks")
async def debug_trucks(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Debug endpoint to check database contents"""
    try:
        total_trucks = db.query(Truck).count()
        recent_trucks = db.query(Truck).order_by(Truck.created_at.desc()).limit(5).all()
        
        date_range = db.query(
            func.min(Truck.created_at).label('earliest'),
            func.max(Truck.created_at).label('latest')
        ).first()
        
        terminals = db.query(Truck.terminal).distinct().all()
        
        debug_info = {
            "total_trucks": total_trucks,
            "date_range": {
                "earliest": date_range.earliest.isoformat() if date_range.earliest else None,
                "latest": date_range.latest.isoformat() if date_range.latest else None
            },
            "terminals": [t[0] for t in terminals],
            "recent_trucks": [
                {
                    "id": truck.id,
                    "shipping_no": truck.shipping_no,
                    "terminal": truck.terminal,
                    "created_at": truck.created_at.isoformat()
                } for truck in recent_trucks
            ]
        }
        
        print(f"🔍 Debug info: {debug_info}")
        return debug_info
        
    except Exception as e:
        print(f"❌ Debug endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*60)
    print("🚀 TRUCK MANAGEMENT SYSTEM API - LOCAL DATABASE")
    print("="*60)
    print("📦 Database: SQLite Local (truck_management.db)")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("🔐 Login Credentials:")
    print("   - Admin: admin/admin123")
    print("="*60)
    print("⚡ WebSocket: ws://localhost:8000/ws")
    print("🏥 Health Check: http://localhost:8000/health")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)