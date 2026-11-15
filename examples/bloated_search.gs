from diet import vegetarian

# Setup inventory items
cheese = 1
butter = 1
pasta = 2
milk = 1

dataset = [10, 25, 42, 67, 89, 99]
target = 67
found = False
index = 0

while index < len(dataset):
    if dataset[index] == target:
        found = True
        break
    index = index + 1

if found:
    print("Target found at index:", index)
else:
    print("Target not found in dataset.")