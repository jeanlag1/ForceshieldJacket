import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, Switch} from 'react-native';
import axios from 'axios';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';


 


export default function App() {
  // const [hasPermission, setHasPermission] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [distance, setDistance] = useState(null);
  const [cameraRef, setCameraRef] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [sceneDescription, setSceneDescription] = useState('');
  const [lastPictureTime, setLastPictureTime] = useState(0);  // Track the time of last picture
  const [isEnabled, setIsEnabled] = useState(false);
  const toggleSwitch = () => setIsEnabled(previousState => !previousState);

  // const [facing, setFacing] = useState<CameraType>('back');
  
  const analyzeSceneWithGpt = async (photo) => {
    const base64Image = await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
    const gptPrompt = `You are given an image. Here's the base64 representation: ${base64Image}. Can you describe the scene in detail?`;

    const apiCall = async (retryCount = 0) => {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/images/generations',
          {
            // model: 'gpt-4',
            //messages: [
              //{ role: 'system', content: 'You are a scene description assistant.' },
              // { role: 'user', content: gptPrompt }
            //]
            prompt: `Describe this image`,
            
            image: base64Image
          },
          {
            headers: {
              'Authorization': ``,
              'Content-Type': 'application/json'
            }
          }
        );

        const description = response.data.choices[0].message.content;
        console.log(description);
        setSceneDescription(description);
        setIsSpeaking(true);
        // const message = `Warning! Object detected at approximately ${fetchedDistance.toFixed(2)} centimeters.`;
        Speech.speak(description, {
            onDone: () => setIsSpeaking(false),  
            onError: () => setIsSpeaking(false), 
          }); 
      } catch (error) {
        if (error.response && error.response.status === 429 && retryCount < 5) {
          // Wait exponentially longer before retrying
          const waitTime = Math.pow(2, retryCount) * 1000; // 2^retryCount seconds
          console.log(`Rate limit hit, retrying in ${waitTime / 1000} seconds...`);
          setTimeout(() => apiCall(retryCount + 1), waitTime);
        } else {
          console.error('Error analyzing the scene with GPT-4: ', error);
          setSceneDescription('Error retrieving description.');
        }
      }
    };

  apiCall();
   
  };
  
   const analyzeSceneWithAzure = async (photo) => {
      try {
        // Read the image as base64
        const base64Image = await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
        
        // Convert the base64 string to a format suitable for the API (binary)
        const imageData = await RNFetchBlob.fs.readFile(imageUri, 'base64');
        console.log(imageData);
        const endpoint = "https://ms-hack-proj.cognitiveservices.azure.com/vision/v3.0/analyze?visualFeatures=Description";
        const response = await axios.post(
          endpoint,
          Buffer.from(base64Image, 'base64'), // Send the image data as binary
          {
            headers: {
              'Ocp-Apim-Subscription-Key': '',
              'Content-Type': 'application/octet-stream' // Binary content type
            }
          }
        );

        const description = response.data.description.captions[0].text;
        setSceneDescription(description);
        console.log(description);
      } catch (error) {
        console.error('Error with Azure Vision API: ', error.response ? error.response.data : error.message);
        setSceneDescription('Error retrieving description.');
      }
    };

  const describeSceneWithBLIP = async (imageUri, fetchedDistance) => {
    try {
      // Convert the image to base64
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Hugging Face API Key and endpoint
      const apiKey = '';  // Replace with your Hugging Face API key
      const apiUrl = 'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base';

      // Send the image to Hugging Face API for analysis
      const response = await axios.post(
        apiUrl,
        {
          inputs: {
            image: base64Image,
            context: "This is an obstacle presented in front of a blind person. Describe it so they can understand what the obstacle is.",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Check if the response contains a description
      if (response.data && response.data[0]?.generated_text) {
        const description = response.data[0].generated_text;
         console.log(description);
         setIsSpeaking(true);
        const message = `In ${fetchedDistance.toFixed(0)} centimeters in front of you there is  ${description}.`;
        Speech.speak(message, {
            onDone: () => setIsSpeaking(false),  
            onError: () => setIsSpeaking(false), 
          }); 
      } else {
        console.error('No description generated');
      }
    } catch (error) {
      console.error('Error describing scene:', error.response ? error.response.data : error.message);
    }
  };


  useEffect(() => {
    (async () => {
      // const { status } = await Camera.requestCameraPermissionsAsync();
      // setHasPermission(status === 'granted');
      requestPermission();
    })();
  }, []);

  useEffect(() => {
    const fetchDistance = async () => {
      try {
        if (!isSpeaking && !(Date.now() - lastPictureTime < 4000) && isEnabled) {
          const response = await axios.get('http://192.168.61.104:8000/distance');
          const fetchedDistance = Math.min(response.data.distance1.toFixed(2), response.data.distance2.toFixed(2) );
          setDistance(fetchedDistance);

          if (fetchedDistance < 100) {
            // Take a picture when distance is less than 15 cm
            if (cameraRef) {
              const capturedPhoto = await cameraRef.takePictureAsync();
              setPhoto(capturedPhoto);
              console.log('Picture taken:', capturedPhoto.uri);
              setLastPictureTime(Date.now());
              await describeSceneWithBLIP(capturedPhoto.uri, fetchedDistance);
              
            }
          }
        }
      } catch (error) {
        console.error('Error fetching distance:', error);
      }
    };

    const interval = setInterval(fetchDistance, 1000);
    return () => clearInterval(interval);
  }, [lastPictureTime, isSpeaking, cameraRef, isEnabled]);

  if (!permission) {
    return <View style={styles.container}><Text>Requesting for camera permission</Text></View>;
   }

  if (!permission.granted) {
    return <View style={styles.container}><Text>No access to cameraaaaaaaaaa</Text></View>;
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera}  ref={ref => setCameraRef(ref)}>
        <View style={styles.buttonContainer}>
          <Switch
        trackColor={{false: '#767577', true: '#81b0ff'}}
        thumbColor={isEnabled ? '#f5dd4b' : '#f4f3f4'}
        ios_backgroundColor="#3e3e3e"
        onValueChange={toggleSwitch}
        value={isEnabled}
      />
          <Text style={styles.distance}>
            {distance !== null ? `Distance: ${distance.toFixed(2)} cm` : 'Fetching distance...'}
          </Text>
        </View>
      </CameraView>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  buttonContainer: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    margin: 20,
  },
  distance: {
    fontSize: 24,
    color: '#fff',
  },
  preview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
