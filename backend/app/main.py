
import pandas as pd
from fastapi import UploadFile, File, Response, FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from jose import JWTError, jwt
from supabase import create_client, Client
import bcrypt
import os
from dotenv import load_dotenv
import json
import uuid
import io
import xlsxwriter

# Load environment variables
load_dotenv()

app = FastAPI(title="Truck Management System API - Supabase")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000",
    "http://localhost:5173",
    "https://*.vercel.app",],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") 
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key-for-dev")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_MINUTES = int(os.getenv("JWT_EXPIRATION_MINUTES", "60"))

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️  Warning: SUPABASE_URL and SUPABASE_KEY not set")
    # สร้าง dummy client สำหรับ development
    class DummySupabase:
        def table(self, name): return self
        def select(self, *args): return self
        def execute(self): return type('obj', (object,), {'data': [], 'count': 0})
    supabase = DummySupabase()
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
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

# Pydantic Models
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

class TruckBase(BaseModel):
    terminal: str
    truck_no: str
    dock_code: str
    truck_route: str
    preparation_start: Optional[str] = None
    preparation_end: Optional[str] = None
    loading_start: Optional[str] = None
    loading_end: Optional[str] = None
    status_preparation: str = "On Process"
    status_loading: str = "On Process"

class TruckCreate(TruckBase):
    pass

class TruckUpdate(BaseModel):
    terminal: Optional[str] = None
    truck_no: Optional[str] = None
    dock_code: Optional[str] = None
    truck_route: Optional[str] = None
    preparation_start: Optional[str] = None
    preparation_end: Optional[str] = None
    loading_start: Optional[str] = None
    loading_end: Optional[str] = None
    status_preparation: Optional[str] = None
    status_loading: Optional[str] = None

class Truck(TruckBase):
    id: str
    created_at: str
    updated_at: Optional[str] = None

class User(BaseModel):
    id: str
    username: str
    role: str

# Helper functions
def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    result = supabase.table("users").select("*").eq("username", username).execute()
    if not result.data:
        raise credentials_exception
    
    user = result.data[0]
    return User(id=user["id"], username=user["username"], role=user["role"])

def check_permission(required_role: str):
    def permission_checker(current_user: User = Depends(get_current_user)):
        role_hierarchy = {"viewer": 0, "user": 1, "admin": 2}
        if role_hierarchy.get(current_user.role, 0) < role_hierarchy.get(required_role, 0):
            raise HTTPException(
                status_code=403,
                detail="Not enough permissions"
            )
        return current_user
    return permission_checker

# Routes
@app.get("/")
def read_root():
    return {
        "message": "Truck Management System API",
        "version": "1.0.0",
        "database": "Supabase Connected" if SUPABASE_URL else "No Database",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
async def health_check():
    try:
        result = supabase.table("trucks").select("count", count="exact").execute()
        return {
            "status": "healthy",
            "database": "connected",
            "truck_count": result.count,
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
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    result = supabase.table("users").select("*").eq("username", form_data.username).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = result.data[0]
    
    if not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=JWT_EXPIRATION_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"]
    }

@app.get("/api/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/api/trucks", response_model=List[Truck])
async def get_trucks(
    skip: int = 0,
    limit: int = 100,
    terminal: Optional[str] = None,
    status_preparation: Optional[str] = None,
    status_loading: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = supabase.table("trucks").select("*")
    
    if terminal:
        query = query.eq("terminal", terminal)
    if status_preparation:
        query = query.eq("status_preparation", status_preparation)
    if status_loading:
        query = query.eq("status_loading", status_loading)
    if date_from:
        date_from_dt = f"{date_from}T00:00:00"
        query = query.gte("created_at", date_from_dt)
    if date_to:
        date_to_dt = f"{date_to}T23:59:59"
        query = query.lte("created_at", date_to_dt)
    
    query = query.range(skip, skip + limit - 1).order("created_at", desc=True)
    result = query.execute()
    
    trucks = [{
        "id": truck["id"],
        "terminal": truck["terminal"],
        "truck_no": truck["truck_no"],
        "dock_code": truck["dock_code"],
        "truck_route": truck["truck_route"],
        "preparation_start": truck["preparation_start"],
        "preparation_end": truck["preparation_end"],
        "loading_start": truck["loading_start"],
        "loading_end": truck["loading_end"],
        "status_preparation": truck["status_preparation"],
        "status_loading": truck["status_loading"],
        "created_at": truck["created_at"],
        "updated_at": truck["updated_at"]
    } for truck in result.data]
    
    return trucks

@app.get("/api/stats")
async def get_stats(
    terminal: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = supabase.table("trucks").select("terminal, status_preparation, status_loading")
    
    if terminal:
        query = query.eq("terminal", terminal)
    if date_from:
        date_from_dt = f"{date_from}T00:00:00"
        query = query.gte("created_at", date_from_dt)
    if date_to:
        date_to_dt = f"{date_to}T23:59:59"
        query = query.lte("created_at", date_to_dt)
    
    result = query.execute()
    trucks = result.data
    
    # Calculate statistics
    total_trucks = len(trucks)
    preparation_stats = {"On Process": 0, "Delay": 0, "Finished": 0}
    loading_stats = {"On Process": 0, "Delay": 0, "Finished": 0}
    terminal_stats = {}
    
    for truck in trucks:
        # Preparation stats
        prep_status = truck.get("status_preparation", "On Process")
        if prep_status in preparation_stats:
            preparation_stats[prep_status] += 1
        
        # Loading stats
        load_status = truck.get("status_loading", "On Process")
        if load_status in loading_stats:
            loading_stats[load_status] += 1
        
        # Terminal stats
        term = truck.get("terminal", "Unknown")
        terminal_stats[term] = terminal_stats.get(term, 0) + 1
    
    return {
        "total_trucks": total_trucks,
        "preparation_stats": preparation_stats,
        "loading_stats": loading_stats,
        "terminal_stats": terminal_stats
    }
@app.post("/api/trucks", response_model=Truck)
async def create_truck(
    truck: TruckCreate,
    current_user: User = Depends(check_permission("user"))
):
    truck_data = truck.dict()
    truck_data['id'] = str(uuid.uuid4())  # Generate UUID as string
    truck_data['created_at'] = datetime.utcnow().isoformat()
    truck_data['updated_at'] = None

    # Validate status fields
    valid_statuses = ['On Process', 'Delay', 'Finished']
    if truck_data.get('status_preparation') not in valid_statuses:
        truck_data['status_preparation'] = 'On Process'
    if truck_data.get('status_loading') not in valid_statuses:
        truck_data['status_loading'] = 'On Process'

    try:
        # Check if truck_no already exists
       # existing = supabase.table("trucks").select("id").eq("truck_no", truck_data['truck_no']).execute()
        #if existing.data:
            #raise HTTPException(status_code=400, detail="Truck number already exists")

        # Insert truck into Supabase
        result = supabase.table("trucks").insert(truck_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create truck")
        
        created_truck = result.data[0]
        
        # Broadcast update via WebSocket
        await manager.broadcast({
            "type": "truck_created",
            "data": created_truck
        })
        
        return created_truck
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating truck: {str(e)}")
    
        
@app.get("/api/trucks/template")
async def download_import_template():
    template_data = {
        'Terminal': ['A', 'B', 'C'],
        'Truck No': ['TRK001', 'TRK002', 'TRK003'],
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
        instructions.write('A1', 'Import Instructions:', workbook.add_format({'bold': True, 'size': 14}))
        instructions.write('A3', '1. Fill in the Template sheet with your truck data')
        instructions.write('A4', '2. Required fields: Terminal, Truck No, Dock Code, Route')
        instructions.write('A5', '3. Optional fields: Time fields and Status fields')
        instructions.write('A6', '4. Valid status values: "On Process", "Delay", "Finished"')
        instructions.write('A7', '5. Time format: HH:MM (24-hour format)')
        instructions.write('A8', '6. Save the file and upload through the Management page')
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
        worksheet.set_column('A:A', 12)
        worksheet.set_column('B:B', 12)
        worksheet.set_column('C:C', 12)
        worksheet.set_column('D:D', 20)
        worksheet.set_column('E:E', 12)
        worksheet.set_column('F:F', 12)
        worksheet.set_column('G:G', 12)
        worksheet.set_column('H:H', 12)
        worksheet.set_column('I:I', 12)
        worksheet.set_column('J:J', 12)
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=truck_import_template.xlsx'}
    )

@app.get("/api/trucks/export")
async def export_trucks_excel(
    terminal: Optional[str] = None,
    status_preparation: Optional[str] = None,
    status_loading: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = supabase.table("trucks").select("*")
    
    if terminal:
        query = query.eq("terminal", terminal)
    if status_preparation:
        query = query.eq("status_preparation", status_preparation)
    if status_loading:
        query = query.eq("status_loading", status_loading)
    if date_from:
        date_from_dt = f"{date_from}T00:00:00"
        query = query.gte("created_at", date_from_dt)
    if date_to:
        date_to_dt = f"{date_to}T23:59:59"
        query = query.lte("created_at", date_to_dt)
        
    result = query.execute()
    trucks = result.data
    df = pd.DataFrame(trucks)
    
    column_mapping = {
        'terminal': 'Terminal',
        'truck_no': 'Truck No',
        'dock_code': 'Dock Code',
        'truck_route': 'Route',
        'preparation_start': 'Prep Start',
        'preparation_end': 'Prep End',
        'loading_start': 'Load Start',
        'loading_end': 'Load End',
        'status_preparation': 'Status Prep',
        'status_loading': 'Status Load',
        'created_at': 'Created Date',
        'updated_at': 'Last Updated'
    }
    
    df = df.rename(columns=column_mapping)
    export_columns = [
        'Terminal', 'Truck No', 'Dock Code', 'Route',
        'Prep Start', 'Prep End', 'Load Start', 'Load End',
        'Status Prep', 'Status Load', 'Created Date', 'Last Updated'
    ]
    export_columns = [col for col in export_columns if col in df.columns]
    df = df[export_columns]
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Trucks', index=False)
        workbook = writer.book
        worksheet = writer.sheets['Trucks']
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4CAF50',
            'font_color': 'white',
            'border': 1
        })
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
        for i, col in enumerate(df.columns):
            column_width = max(df[col].astype(str).map(len).max(), len(col)) + 2
            worksheet.set_column(i, i, column_width)
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f'attachment; filename=trucks_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        }
    )

@app.post("/api/trucks/import/preview")
async def preview_excel_import(
    file: UploadFile = File(...),
    current_user: User = Depends(check_permission("user"))
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "File must be Excel format (.xlsx or .xls)")
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        required_columns = {
            'Terminal': 'terminal',
            'Truck No': 'truck_no', 
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
        
        for index, row in df.iterrows():
            try:
                truck = {}
                for excel_col, db_col in required_columns.items():
                    value = row.get(excel_col, '')
                    if pd.isna(value) or str(value).strip() == '':
                        errors.append(f"Row {index + 2}: {excel_col} is required")
                        continue
                    truck[db_col] = str(value).strip()
                
                for excel_col, db_col in optional_columns.items():
                    if excel_col in df.columns:
                        value = row.get(excel_col)
                        if not pd.isna(value):
                            if 'start' in db_col or 'end' in db_col:
                                try:
                                    if isinstance(value, datetime):
                                        truck[db_col] = value.strftime('%H:%M')
                                    else:
                                        truck[db_col] = str(value)
                                except:
                                    truck[db_col] = str(value)
                            else:
                                truck[db_col] = str(value)
                        else:
                            truck[db_col] = None
                
                if 'status_preparation' not in truck:
                    truck['status_preparation'] = 'On Process'
                if 'status_loading' not in truck:
                    truck['status_loading'] = 'On Process'
                
                valid_statuses = ['On Process', 'Delay', 'Finished']
                if truck.get('status_preparation') not in valid_statuses:
                    truck['status_preparation'] = 'On Process'
                if truck.get('status_loading') not in valid_statuses:
                    truck['status_loading'] = 'On Process'
                
                trucks_preview.append(truck)
                
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        session_id = str(uuid.uuid4())
        import_sessions[session_id] = {
            'trucks': trucks_preview,
            'user_id': current_user.id,
            'timestamp': datetime.utcnow()
        }
        
        return {
            "success": True,
            "session_id": session_id,
            "preview": trucks_preview[:10],
            "total_rows": len(trucks_preview),
            "errors": errors,
            "columns_found": list(df.columns),
            "sample_data": df.head(5).to_dict('records')
        }
        
    except Exception as e:
        raise HTTPException(400, f"Error reading Excel file: {str(e)}")

@app.post("/api/trucks/import/confirm")
async def confirm_excel_import(
    data: dict,
    current_user: User = Depends(check_permission("user"))
):
    session_id = data.get('session_id')
    session = import_sessions.get(session_id)
    if not session:
        raise HTTPException(400, "Import session not found or expired")
    
    if session['user_id'] != current_user.id:
        raise HTTPException(403, "Unauthorized")
    
    trucks_to_import = session['trucks']
    imported_count = 0
    failed_imports = []
    
    try:
        for index, truck_data in enumerate(trucks_to_import):
            try:
                truck_data['created_at'] = datetime.utcnow().isoformat()
                existing = supabase.table("trucks").select("id").eq("truck_no", truck_data['truck_no']).execute()
                
                if existing.data:
                    result = supabase.table("trucks").update(truck_data).eq("truck_no", truck_data['truck_no']).execute()
                else:
                    result = supabase.table("trucks").insert(truck_data).execute()
                
                if result.data:
                    imported_count += 1
                    await manager.broadcast({
                        "type": "truck_created",  # Changed to match frontend
                        "data": result.data[0]
                    })
                    
            except Exception as e:
                failed_imports.append({
                    "row": index + 1,
                    "truck_no": truck_data.get('truck_no', 'Unknown'),
                    "error": str(e)
                })
        
        del import_sessions[session_id]
        
        return {
            "success": True,
            "imported": imported_count,
            "failed": len(failed_imports),
            "failed_details": failed_imports,
            "message": f"Successfully imported {imported_count} trucks"
        }
        
    except Exception as e:
        raise HTTPException(500, f"Import failed: {str(e)}")

@app.get("/api/trucks/{truck_id}", response_model=Truck)
async def get_truck(
    truck_id: str,
    current_user: User = Depends(get_current_user)
):
    result = supabase.table("trucks").select("*").eq("id", truck_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    return result.data[0]

@app.put("/api/trucks/{truck_id}", response_model=Truck)
async def update_truck(
    truck_id: str,
    truck: TruckUpdate,
    current_user: User = Depends(check_permission("user"))
):
    update_data = truck.dict(exclude_unset=True)
    update_data['updated_at'] = datetime.utcnow().isoformat()
    
    result = supabase.table("trucks").update(update_data).eq("id", truck_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    updated_truck = result.data[0]
    await manager.broadcast({
        "type": "truck_updated",
        "data": updated_truck
    })
    
    return updated_truck

@app.delete("/api/trucks/{truck_id}")
async def delete_truck(
    truck_id: str,
    current_user: User = Depends(check_permission("admin"))
):
    result = supabase.table("trucks").delete().eq("id", truck_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Truck not found")
    
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
    current_user: User = Depends(check_permission("user"))
):
    if status_type not in ["preparation", "loading"]:
        raise HTTPException(status_code=400, detail="Invalid status type")
    
    if status not in ["On Process", "Delay", "Finished"]:
        raise HTTPException(status_code=400, detail="Invalid status value")
    
    field = f"status_{status_type}"
    update_data = {field: status, "updated_at": datetime.utcnow().isoformat()}
    
    result = supabase.table("trucks").update(update_data).eq("id", truck_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    updated_truck = result.data[0]
    await manager.broadcast({
        "type": "status_updated",
        "data": updated_truck
    })
    
    return updated_truck

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
    print("🚀 TRUCK MANAGEMENT SYSTEM API - SUPABASE")
    print("="*60)
    print(f"📡 Supabase URL: {SUPABASE_URL[:30]}..." if SUPABASE_URL else "❌ No Supabase URL")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("🔐 Login Credentials:")
    print("   - Admin: admin/admin123")
    print("   - User: user/admin123")
    print("="*60)
    print("⚡ WebSocket: ws://localhost:8000/ws")
    print("🏥 Health Check: http://localhost:8000/health")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
