import json
import time
import logging
import sys
import pika
import threading
import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
import uvicorn

app = FastAPI()

Instrumentator().instrument(app).expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- LOGGING CONFIGURATION ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NotificationService")

DB_CONFIG = {
    "host": "db",
    "database": "ticketing_system",
    "user": "admin",
    "password": "password123"
}

def get_db_connection():
    for i in range(5):
        try:
            return psycopg2.connect(**DB_CONFIG)
        except psycopg2.OperationalError:
            logger.warning("DB not ready, retrying (%d/5)", i + 1)
            time.sleep(2)
    raise Exception("Could not connect to database")

# --- RABBITMQ CONSUMER WITH RETRY ---
def start_rabbitmq_consumer():
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters(
                host='rabbitmq',
                heartbeat=60,
                blocked_connection_timeout=300
            ))
            channel = connection.channel()
            channel.queue_declare(queue='task_queue', durable=True)
            logger.info("Successfully connected to RabbitMQ.")

            def callback(ch, method, properties, body):
                try:
                    data = json.loads(body.decode())
                    user_id = data.get("user_id")
                    message = data.get("message")
                    logger.info("Processing alert for User %s: %s", user_id, message)
                    conn = get_db_connection()
                    cur = conn.cursor()
                    cur.execute(
                        "INSERT INTO notifications (user_id, message) VALUES (%s, %s)",
                        (user_id, message)
                    )
                    conn.commit()
                    cur.close()
                    conn.close()
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                except psycopg2.Error as e:
                    logger.error("Database error in callback: %s", e)
                except Exception as e:
                    logger.error("Unexpected error in callback: %s", e)

            channel.basic_consume(queue='task_queue', on_message_callback=callback)
            channel.start_consuming()

        except Exception as e:
            logger.error("RabbitMQ connection failed, retrying in 5s: %s", e)
            time.sleep(5)

# --- API ENDPOINTS ---
@app.get("/health")
def health():
    return {"status": "ok", "service": "notification-service"}

@app.get("/notifications")
def get_notifications():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, user_id, message, sent_at FROM notifications ORDER BY sent_at DESC")
        rows = cur.fetchall()
        results = [{"id": r[0], "user_id": r[1], "message": r[2], "sent_at": r[3]} for r in rows]
        cur.close()
        conn.close()
        return results
    except psycopg2.Error as e:
        logger.error("Failed to fetch notifications from DB: %s", e)
        raise HTTPException(status_code=500, detail="Database connection failed")

if __name__ == "__main__":
    rabbit_thread = threading.Thread(target=start_rabbitmq_consumer, daemon=True)
    rabbit_thread.start()
    uvicorn.run(app, host="0.0.0.0", port=5000)