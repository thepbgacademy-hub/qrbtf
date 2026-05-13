export function toBase64(
  file: File,
  aspectRatio: number = 1,
  maxDimension?: number,
) {
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  let img = document.createElement("img");
  img.setAttribute("src", URL.createObjectURL(file));

  return new Promise((resolve) => {
    img.onload = () => {
      let width, height;
      if (img.width < img.height) {
        width = img.width;
        height = width / aspectRatio;
      } else {
        height = img.height;
        width = height * aspectRatio;
      }

      if (maxDimension && Math.max(width, height) > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.setAttribute("width", Math.round(width).toString());
      canvas.setAttribute("height", Math.round(height).toString());

      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(
          img,
          (img.width - width) / 2,
          (img.height - height) / 2,
          width,
          height,
          0,
          0,
          width,
          height,
        );
      }
      resolve(canvas.toDataURL(file.type, 0.9));
    };
  });
}

export function gamma(r: number, g: number, b: number) {
  return Math.pow(
    (Math.pow(r, 2.2) + Math.pow(1.5 * g, 2.2) + Math.pow(0.6 * b, 2.2)) /
      (1 + Math.pow(1.5, 2.2) + Math.pow(0.6, 2.2)),
    1 / 2.2,
  );
}
