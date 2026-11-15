# GastroScript demo. Open the stomach (pulse icon, top right) and start eating.
# Try adding:   jalapeno = 2     cheddar = 1     counter = 0
# Rescue with:  celery = 1       antacid = 1
from diet import halal

rice = 2
broccoli = 1
bacon_free_beans = 1

def serve(potato, carrot):
    return potato + carrot


for apple in range(rice):
    print("Plate", apple + 1, "has", serve(rice, broccoli), "things on it")
