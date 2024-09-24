
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from gpiozero import DistanceSensor, OutputDevice
from time import sleep
import threading

# Initialize FastAPI app
app = FastAPI()

# Allow requests from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace "*" with the specific origin if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up the sensor with GPIO pins
sensor1 = DistanceSensor(echo=24, trigger=23)
sensor2 = DistanceSensor(echo=27, trigger=17)
distance1 = 0  # Variable to hold distance value
distance2 = 0

vibrator1 = OutputDevice(16)  # GPIO pin 18 for vibrator 1
vibrator2 = OutputDevice(26)  # GPIO pin 22 for vibrator 2


def measure_distance():
    global distance1
    global distance2
    while True:
        distance1 = sensor1.distance * 100  # Convert to cm
        distance2 = sensor2.distance * 100
        if distance1 < 100:
            vibrator1.on()
        else:
            vibrator1.off()
        
        if distance2 < 100:
            vibrator2.on()
        else:
            vibrator2.off()
        #sleep(0.1)

# Start the distance measurement in a separate thread
distance_thread = threading.Thread(target=measure_distance)
distance_thread.daemon = True
distance_thread.start()

@app.get("/distance")
def get_distance():
	return {"distance1": distance1,"distance2": distance2}

# Run the FastAPI server (you'll run this via a command later)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
