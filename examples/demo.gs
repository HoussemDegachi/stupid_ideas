from diet import halal

rice = 2
broccoli = 1
bacon_free_beans = 1

def serve(potato, carrot):
    return potato + carrot


for apple in range(rice):
    print("Plate", apple + 1, "has", serve(rice, broccoli), "things on it")
