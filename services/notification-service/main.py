import json
import logging
import sys
import pika
import threading
import psycopg2
from fastapi import FastAPI, HTTPException
from prometheus_fastapi_instrumentator import Instrumentator
import uvicorn

app = FastAPI()
Instrumentator().instrument(app).expose(app)

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
    return psycopg2.connect(**DB_CONFIG)

# --- 1. RABBITMQ CONSUMER ---
def start_rabbitmq_consumer():
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters(host='rabbitmq'))
        channel = connection.channel()
        channel.queue_declare(queue='task_queue', durable=True)
        logger.info("Successfully connected to RabbitMQ.")
    except Exception as e:
        logger.error("Failed to connect to RabbitMQ: %s", e)
        return

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
            logger.error("Database error during RabbitMQ callback: %s", e)
            # We don't ACK here so the message stays in RabbitMQ to try again later
        except Exception as e:
            logger.error("Unexpected error in callback: %s", e)

    channel.basic_consume(queue='task_queue', on_message_callback=callback)
    channel.start_consuming()

# --- 2. API ENDPOINT ---
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
        # Raise an HTTP 500 error so the Frontend knows something is wrong
        raise HTTPException(status_code=500, detail="Database connection failed")

if __name__ == "__main__":
    rabbit_thread = threading.Thread(target=start_rabbitmq_consumer, daemon=True)
    rabbit_thread.start()
    uvicorn.run(app, host="0.0.0.0", port=5000)
