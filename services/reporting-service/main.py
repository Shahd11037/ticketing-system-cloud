import logging
import sys
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
import psycopg2
import uvicorn

app = FastAPI()

#Initialize the instrumentator and "plug it into" your app
Instrumentator().instrument(app).expose(app) #this is for monitoring

# Configure logging to output to stdout (which Docker collects)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("NotificationService") # Or ReportingService

DB_CONFIG = {
    "host": "db",
    "database": "ticketing_system",
    "user": "admin",
    "password": "password123"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

@app.get("/reports/summary")
def get_ticket_summary():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Query 1: Performance (Count by Status)
        cur.execute("SELECT status, COUNT(*) FROM tickets GROUP BY status")
        status_counts = dict(cur.fetchall())

        # Query 2: Response Time (Average time in minutes)
        # We join tickets and support_assignments to find the time gap
        cur.execute("""
            SELECT AVG(EXTRACT(EPOCH FROM (s.assigned_at - t.created_at)) / 60)
            FROM tickets t
            JOIN support_assignments s ON t.id = s.ticket_id
        """)
        avg_response_minutes = cur.fetchone()[0] or 0

        cur.close()
        conn.close()

        return {
            "total_tickets_by_status": status_counts,
            "average_response_time_minutes": round(avg_response_minutes, 2)
        }
    except psycopg2.Error as e:
        logger.error("Reporting Service failed to query DB: %s", e)
        raise HTTPException(status_code=500, detail="Could not generate report")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
