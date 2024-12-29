#!/bin/bash

# Create models directory if it doesn't exist
mkdir -p src/assets/models

# Define the base URL for the models
BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

# List of model files to download
declare -a MODEL_FILES=(
    "ssd_mobilenetv1_model-weights_manifest.json"
    "ssd_mobilenetv1_model-shard1"
    "ssd_mobilenetv1_model-shard2"
    "face_landmark_68_model-weights_manifest.json"
    "face_landmark_68_model-shard1"
    "face_recognition_model-weights_manifest.json"
    "face_recognition_model-shard1"
    "face_recognition_model-shard2"
    "tiny_face_detector_model-weights_manifest.json"
    "tiny_face_detector_model-shard1"
)

# Download each model file
for file in "${MODEL_FILES[@]}"
do
    echo "Downloading $file..."
    curl -L "$BASE_URL/$file" --create-dirs -o "src/assets/models/$file"
    
    # Check if download was successful
    if [ $? -eq 0 ]; then
        echo "Successfully downloaded $file"
    else
        echo "Failed to download $file"
        exit 1
    fi
done

echo "All model files have been downloaded successfully!"
