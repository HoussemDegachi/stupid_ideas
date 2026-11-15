# High intensity computational task with heavy loads
lard = 3
ghost_pepper = 2
celery = 10

chicken = [12, 45, 89, 23, 67, 99, 34]
steak = chicken[0]
apple = 1

while apple < len(chicken):
    if chicken[apple] > steak:
        bacon = chicken[apple]
    apple = apple + 1

print("Maximum value computed:", bacon)