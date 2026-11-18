// The third-person camera: an orbit around the player on foot, a chase cam
// behind the car while driving, smoothed with critically-damped springs so it
// never snaps. FOV kicks up with speed. Mouse drag / pointer lock turns it.
import * as THREE from 'three';

export function createCamera(camera) {
  let yaw = Math.PI; // around the target, 0 = looking north (-z is forward of the player at yaw 0)
  let pitch = 0.42; // radians above horizontal
  let distance = 9;
  const currentPos = new THREE.Vector3(0, 6, 12);
  const currentTarget = new THREE.Vector3(0, 1.5, 0);
  let fov = 62;
  camera.fov = fov;
  camera.near = 0.1;
  camera.far = 900;
  camera.updateProjectionMatrix();

  function update(dt, target, driving, speed01, city) {
    // Desired distance and height: further and higher in a car.
    const wantDist = driving ? 10 : 8.5;
    const wantHeight = driving ? 3.6 : 2.6;
    distance += (wantDist - distance) * Math.min(1, dt * 3);
    const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * distance;
    const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * distance;
    const cy = target.y + wantHeight + Math.sin(pitch) * distance * 0.6;
    // Keep the camera out of buildings: lift it if the spot is inside one.
    const resolved = city.collideCircle(cx, cz, 0.8);
    const goal = new THREE.Vector3(resolved.x, cy, resolved.z);
    if (resolved.hit) goal.y += 3;
    const k = 1 - Math.exp(-dt * (driving ? 5 : 7));
    currentPos.lerp(goal, k);
    const lookAt = new THREE.Vector3(target.x, target.y + 1.6, target.z);
    currentTarget.lerp(lookAt, 1 - Math.exp(-dt * 9));
    camera.position.copy(currentPos);
    camera.lookAt(currentTarget);
    // FOV kick with speed.
    const wantFov = 62 + (driving ? speed01 * 14 : 0);
    fov += (wantFov - fov) * Math.min(1, dt * 4);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  return {
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    addLook(dx, dy) {
      yaw -= dx * 0.0032;
      pitch = Math.max(0.05, Math.min(1.1, pitch + dy * 0.0025));
    },
    setYaw(value) { yaw = value; },
    setPitch(value) { pitch = value; },
    snapTo(target) {
      const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * distance;
      const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * distance;
      currentPos.set(cx, target.y + 3 + Math.sin(pitch) * distance * 0.6, cz);
      currentTarget.set(target.x, target.y + 1.6, target.z);
      camera.position.copy(currentPos);
      camera.lookAt(currentTarget);
    },
    update,
  };
}
