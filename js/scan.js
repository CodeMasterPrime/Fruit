async function init() {
    try {
        console.log("Start loading model...");

        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";

        model = await tmImage.load(modelURL, metadataURL);

        console.log("Model loaded");

        webcam = new tmImage.Webcam(300, 300, true);
        await webcam.setup();
        await webcam.play();

        console.log("Camera started");

        document.getElementById("webcam-container").appendChild(webcam.canvas);

        window.requestAnimationFrame(loop);

    } catch (error) {
        console.error(error);
        alert("Error: " + error);
    }
}
