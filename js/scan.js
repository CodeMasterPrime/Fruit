console.log("scan.js loaded");
console.log(typeof tmImage);
const URL = "./model/";

let model, webcam;

async function init() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    model = await tmImage.load(modelURL, metadataURL);

    webcam = new tmImage.Webcam(300, 300, true);
    await webcam.setup();
    await webcam.play();

    document.getElementById("webcam-container").innerHTML = "";
    document.getElementById("webcam-container").appendChild(webcam.canvas);

    window.requestAnimationFrame(loop);
}

async function loop() {
    webcam.update();
    await predict();
    window.requestAnimationFrame(loop);
}

async function predict() {
    const prediction = await model.predict(webcam.canvas);

    prediction.sort((a, b) => b.probability - a.probability);

    const best = prediction[0];

    document.getElementById("result").innerHTML =
        "Result: " + best.className +
        " (" + (best.probability * 100).toFixed(2) + "%)";
}
