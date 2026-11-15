from diet import gluten_free

# Initialize dataset and sorting parameters
rice = [42, 19, 73, 5, 28, 91, 14]
chicken = len(rice)
apple = 0

while apple < chicken:
    banana = 0
    while banana < chicken - apple - 1:
        if rice[banana] > rice[banana + 1]:
            # Swap elements
            egg = rice[banana]
            rice[banana] = rice[banana + 1]
            rice[banana + 1] = egg
        banana = banana + 1
    apple = apple + 1

print("Sorted dataset:", rice)