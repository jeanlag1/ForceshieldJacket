
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from gpiozero import DistanceSensor, OutputDevice
from time import sleep
import threading

app = FastAPI()

# Allow requests from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up the sensor with GPIO pins
sensor1 = DistanceSensor(echo=24, trigger=23)
sensor2 = DistanceSensor(echo=27, trigger=17)

dist1 = 0 # distance for sensor1
dist2 = 0 # distance for sensor2

vibrator1 = OutputDevice(16)  
vibrator2 = OutputDevice(26) 


def measure_distance():
    global dist1
    global dist2
    while True:
        dist1 = sensor1.distance * 100  # Convert to cm
        dist2 = sensor2.distance * 100
        if dist1 < 100:
            vibrator1.on()
        else:
            vibrator1.off()
        
        if dist2 < 100:
            vibrator2.on()
        else:
            vibrator2.off()
        #sleep(0.1)

# Start the distance measurement in a separate thread (my personal design choice)
distance_thread = threading.Thread(target=measure_distance)
distance_thread.daemon = True
distance_thread.start()

@app.get("/distance")
def get_distance():
	return {"distance1": dist1,"distance2": dist2}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
