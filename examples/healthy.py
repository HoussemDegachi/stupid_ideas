# A balanced program. Runs exactly as written.
rice = 3
broccoli = 2
tofu = 1


def cook(potato, carrot):
    return potato * carrot


for apple in range(rice):
    print("Serving", apple + 1, "of", rice, "->", cook(apple + 1, broccoli))

print("Protein:", tofu * 10, "grams")
