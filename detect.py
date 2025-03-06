import cv2
from ultralytics import YOLO
import pyttsx3
import time

# Function for text-to-speech
def speech(text):
    engine = pyttsx3.init()
    engine.say(text)
    engine.runAndWait()

# Load the YOLO model
model = YOLO('./neck2.pt')  # Replace with the path to your trained model

# Open the video file or camera
cap = cv2.VideoCapture(0)  # Replace 0 with the path to your video file if needed

if not cap.isOpened():
    print("Error: Unable to open video file or camera.")
    exit()

# Create a resizable window
cv2.namedWindow('YOLOv8 Real-Time Detection', cv2.WINDOW_NORMAL)
cv2.moveWindow('YOLOv8 Real-Time Detection', 100, 100)
cv2.resizeWindow('YOLOv8 Real-Time Detection', 800, 600)

# Timer to control audio feedback
last_audio_time = 0  # Initialize the last audio playback time
audio_interval = 5  # Interval in seconds

# Mapping classes to spoken feedback
class_to_text = {
    "500_new": "500 rupee note detected",
    "500_folded": "500 rupee note detected",
    "200_new": "200 rupee note detected",
    "200_folded": "200 rupee note detected",
    "100_new": "100 rupee note detected",
    "100_folded": "100 rupee note detected",
    "50_new":"50 rupee note detected",
    # Add mappings for other classes as needed
}
totalsum=0
flag=0
while cap.isOpened():
    ret, frame = cap.read()  # Capture frame-by-frame
    if not ret:
        print("End of video or error reading frame.")
        break

    # Use YOLOv8 model to predict objects in the frame
    results = model.track(frame, persist=True, conf=0.50,verbose=False)  # Adjust confidence threshold
    current_time = time.time()  # Get the current time
    #print(current_time)
    
    if current_time - last_audio_time > 10 and flag==1: 
        print(" counting mode terminated\n")
        speech("Counting mode terminated, total sum is "+str(totalsum)+" rupees") 
        totalsum=0
        flag=0
    # Annotate the frame with YOLO predictions
    if results:
        annotated_frame = results[0].plot()  # Visualize predictions
        
        # Extract the detected classes
        current_time = time.time()  # Get the current time
        
        if current_time - last_audio_time > audio_interval:  # Check if enough time has passed
            detected_classes = [box.cls for box in results[0].boxes]  # Extract detected class indices
            class_names = [model.names[int(cls)] for cls in detected_classes]  # Map indices to class names

            # Check if any class matches the desired mappings
            for class_name in class_names:
                if class_name in class_to_text:
                    feedback_text = class_to_text[class_name]
                    print(feedback_text)  # Print feedback for debugging
                    speech(feedback_text)  # Trigger audio feedback
                    
                    content = class_name.split('_')
                    rupees = int(content[0])
                    checker=class_name[-1]
                    if (checker!="folded"):
                        if(flag==0):
                            print("new counting mode started")
                            
                            speech("New counting mode started")
                        totalsum+=rupees
                        print("total sum:"+str(totalsum)+"\n")
                        flag=1
                        
                    else:
                        print("folded")
                    last_audio_time = current_time  # Update the last audio playback time
                    break  # Exit the loop to avoid overlapping detections within the interval

    else:
        annotated_frame = frame  # Display the frame as-is if no results

    # Show the annotated frame
    cv2.imshow('YOLOv8 Real-Time Detection', annotated_frame)

    # Press 'q' to quit the video feed
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release the video capture and close all OpenCV windows
cap.release()
cv2.destroyAllWindows()