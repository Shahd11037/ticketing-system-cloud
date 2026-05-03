import json
import time
import logging
import psycopg2
import pika
import uvicorn
from fastapi import FastAPI, HTTPException

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TicketService")

# connection info ll db w rabbitmq
DB_CONFIG = {
    "host": "db",
    "database": "ticketing_system",
    "user": "admin",
    "password": "password123"
}

RABBITMQ_HOST = "rabbitmq"


# b connect 5 marat 3la el db 3lshan lw msh gahza lsa
def get_db():
    for i in range(5):
        try:
            return psycopg2.connect(**DB_CONFIG)
        except psycopg2.OperationalError as e:
            logger.warning("failed to connect, againnn (%d/5)", i + 1)
            time.sleep(2)
    raise Exception("could not connect to database")


# send notification ll rabbitmq
# el notification service hta5odha mn el queue
def send_notification(user_id, message):
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host=RABBITMQ_HOST, heartbeat=30)
        )
        channel = connection.channel()
        channel.queue_declare(queue='task_queue', durable=True)
        channel.basic_publish(
            exchange='',
            routing_key='task_queue',
            body=json.dumps({"user_id": user_id, "message": message}),
            properties=pika.BasicProperties(delivery_mode=2)
        )
        connection.close()
    except Exception as e:
        logger.error("failed to send notification: %s", e)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ticket-service"}


# create a new ticket
@app.post("/tickets", status_code=201)
def create_ticket(ticket: dict):
    if not ticket.get("title") or not ticket.get("created_by"):
        raise HTTPException(status_code=400, detail="title and created_by are required")

    conn = get_db()
    cur = conn.cursor()

    try:
        # check el user mawgood wla la2
        cur.execute("SELECT id FROM users WHERE id = %s", (ticket["created_by"],))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        cur.execute(
            "INSERT INTO tickets (title, description, created_by) VALUES (%s, %s, %s) RETURNING id, title, description, status, created_by, created_at",
            (ticket["title"], ticket.get("description"), ticket["created_by"])
        )
        row = cur.fetchone()
        conn.commit()

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error("error creating ticket: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        cur.close()
        conn.close()

    result = {
        "id": row[0],
        "title": row[1],
        "description": row[2],
        "status": row[3],
        "created_by": row[4],
        "created_at": str(row[5])
    }

    # send notification ll user eno el ticket submitted
    send_notification(ticket["created_by"], f"Ticket #{result['id']} submitted successfully.")
    return result


# get all tickets
@app.get("/tickets")
def get_tickets(status: str = None, created_by: int = None):
    conn = get_db()
    cur = conn.cursor()

    try:
        query = "SELECT id, title, description, status, created_by, created_at FROM tickets WHERE 1=1"
        params = []

        if status:
            query += " AND status = %s"
            params.append(status)

        if created_by:
            query += " AND created_by = %s"
            params.append(created_by)

        query += " ORDER BY created_at DESC"
        cur.execute(query, params)
        rows = cur.fetchall()

    except Exception as e:
        logger.error("Error getting tickets: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        cur.close()
        conn.close()

    return [
        {"id": r[0], "title": r[1], "description": r[2], "status": r[3], "created_by": r[4], "created_at": str(r[5])}
        for r in rows
    ]


# get one ticket by id
@app.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int):
    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("SELECT id, title, description, status, created_by, created_at FROM tickets WHERE id = %s", (ticket_id,))
        row = cur.fetchone()
    except Exception as e:
        logger.error("Error getting ticket: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        cur.close()
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return {"id": row[0], "title": row[1], "description": row[2], "status": row[3], "created_by": row[4], "created_at": str(row[5])}


# update ticket status
@app.patch("/tickets/{ticket_id}/status")
def update_status(ticket_id: int, data: dict):
    valid_statuses = {"open", "in_progress", "resolved", "closed"}

    if not data.get("status"):
        raise HTTPException(status_code=400, detail="status field is required")

    if data["status"] not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"status must be one of {valid_statuses}")

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute(
            "UPDATE tickets SET status = %s WHERE id = %s RETURNING id, status, created_by",
            (data["status"], ticket_id)
        )
        result = cur.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Ticket not found")

        conn.commit()

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error("Error updating ticket: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        cur.close()
        conn.close()

    # send notification ll user about the status change
    send_notification(result[2], f"Ticket #{ticket_id} status updated to '{data['status']}'.")
    return {"message": "Status updated", "ticket_id": result[0], "status": result[1]}


@app.delete("/tickets/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: int):
    """Delete a ticket by ID."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM tickets WHERE id = %s RETURNING id", (ticket_id,))
        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
 
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
 
        logger.info("Ticket #%s deleted.", ticket_id)
        return
 
    except HTTPException:
        raise
    except psycopg2.Error as e:
        logger.error("DB error deleting ticket %s: %s", ticket_id, e)
        raise HTTPException(status_code=500, detail="Database error")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)