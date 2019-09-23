precision mediump float;

uniform float time;
uniform vec2 resolution;
uniform vec2 mouse;


const float eps = 0.001;
float orbit = 3.0;

struct Camera {
    vec3 pos;
    vec3 dir;
    vec3 up;
    vec3 side;
};

struct Ray {
    vec3 origin;
    vec3 dir;
    float len;
};

struct Intersection {
    bool hit;
    vec3 pos;
    float dist;
    vec3 normal;
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
    float shininess;
    float reflectance;
};

void lookAt(vec3 eye, vec3 at, vec3 up, out Camera camera) {
    camera.pos = eye;
    camera.dir = normalize(at - eye);
    camera.up = normalize(up - dot(up, camera.dir) * camera.dir);
    camera.side = cross(camera.dir, camera.up);
}

void createRay(vec2 p, float depth, Camera camera, out Ray ray) {
    ray.origin = camera.pos;
    ray.dir = camera.side * p.x + camera.up * p.y + camera.dir * depth;
    ray.len = 0.0;
}

float smin(float a, float b, float k) {
    float res = exp2(-k * a) + exp2(-k * b);
    return -log2(res) / k;
}

float smin3(float a, float b, float c, float k) {
    float res = exp2(-k * a) + exp2(-k * b) + exp2(-k * c);
    return -log2(res) / k;
}

// 基本形状の距離関数
float sdSphere(vec3 p, float s) {
    return length(p) - s;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xy) - t.x, p.z);
    return length(q) - t.y;
}

float sdPlane(vec3 p, vec3 n, float h) {
    return dot(p, n) + h;
}

// オブジェクトごとの距離関数
float dCore(vec3 p) {
    return sdSphere(p, 0.7);
}

float dRing(vec3 p) {
    return smin3(
        sdTorus(p, vec2(1.3, 0.1)),
        sdTorus(vec3(p.z, p.x, p.y), vec2(1.3, 0.1)),
        sdTorus(vec3(p.z, p.y, p.x), vec2(1.3, 0.1)),
        15.0
    );
}

float dFloor(vec3 p) {
    return sdPlane(p, vec3(0.0, 1.0, 0.0), 2.0);
}

// 全体の距離関数
float dObjects(vec3 p) {
    return min(min(dCore(p), dRing(p)), dFloor(p));
}

vec3 getNormal(vec3 p) {
    return normalize(vec3(
        dObjects(p + vec3(eps, 0.0, 0.0)) - dObjects(p - vec3(eps, 0.0, 0.0)),
        dObjects(p + vec3(0.0, eps, 0.0)) - dObjects(p - vec3(0.0, eps, 0.0)),
        dObjects(p + vec3(0.0, 0.0, eps)) - dObjects(p - vec3(0.0, 0.0, eps))
    ));
}

// レイマーチ
void intersectObjects(inout Ray ray, out Intersection intersection) {
    vec3 p = ray.origin;

    for (int i = 0; i < 500; i++) {
        intersection.dist = dObjects(p);
        ray.len += intersection.dist;
        p = ray.origin + ray.dir * ray.len;
        if (abs(intersection.dist) < eps || ray.len > 100.0) break;
    }

    intersection.hit = abs(intersection.dist) < eps;
    intersection.reflectance = 0.0;

    if (intersection.hit) {
        intersection.pos = p;
        intersection.normal = getNormal(p);
        if (abs(dCore(p)) < eps) {
            intersection.ambient = vec3(0.3, 0.1, 0.1);
            intersection.diffuse = vec3(1.0, 0.1, 0.0);
            intersection.specular = vec3(1.0);
            intersection.shininess = 100.0;
            intersection.reflectance = 0.1;
        } else if (abs(dRing(p)) < eps) {
            intersection.ambient = vec3(0.2, 0.16, 0.1);
            intersection.diffuse = vec3(0.5, 0.4, 0.1);
            intersection.specular = vec3(1.0);
            intersection.shininess = 10.0;
            intersection.reflectance = 0.4;
        } else if (abs(dFloor(p)) < eps) {
            intersection.ambient = vec3(0.3);
            intersection.diffuse = (mod(p.x, 3.0) < 1.5 ^^ mod(p.z, 3.0) < 1.5) ? vec3(0.5) : vec3(0.3);
            intersection.specular = vec3(0.0);
            intersection.shininess = 1.0;
        }
    }
}

float calcShadow(Ray ray) {
    const float intensity = 0.5;
    const float sharpness = 15.0;

    float dist;
    float bright = 1.0;

    for (int i = 0; i < 50; i++) {
        dist = dObjects(ray.origin + ray.dir * ray.len);
        if (abs(dist) < eps) return 1.0 - intensity;
        bright = min(bright, sharpness * dist / ray.len);
        ray.len += dist;
    }
    return 1.0 - (1.0 - bright) * intensity;
}

float calcAO(Ray ray) {
    float occ = 0.0;
    float k = 1.0;
    for (int i = 0; i < 5; i++) {
        ray.len = (float(i) + 1.0) * 0.1;
        float dist = dObjects(ray.origin + ray.dir * ray.len);
        occ += (ray.len - dist) * k;
        k *= 0.5;
    }
    return clamp(1.0 - occ, 0.0, 1.0);
}

vec3 calcColor(Ray ray, Intersection intersection) {
    vec3 fogColor = vec3(0.5, 0.6, 0.5);

    if (intersection.hit) {
        vec3 lightDir = normalize(vec3(2.0, 3.0, 1.0));
        vec3 lightColor = vec3(1.0);

        Ray shadowRay;
        shadowRay.origin = intersection.pos + intersection.normal * eps * 100.0;
        shadowRay.dir = lightDir;
        shadowRay.len = 0.0;
        float shadow = calcShadow(shadowRay);

        shadowRay.dir = intersection.normal;
        shadowRay.len = 0.0;
        float ao = calcAO(shadowRay);

        vec3 ambient = vec3(0.8, 1.0, 0.8) * ao;
        vec3 diffuse = lightColor * shadow * max(dot(lightDir, intersection.normal), 0.0);
        vec3 specular = lightColor * pow(max(dot(lightDir, reflect(ray.dir, intersection.normal)), 0.0), intersection.shininess) * shadow;
        // diffuse = vec3(0.0);
        // specular = vec3(0.0);

        vec3 color = intersection.ambient * ambient
            + intersection.diffuse * diffuse
            + intersection.specular * specular;
        
        float fogIntensity = 1.0 - exp(-0.002 * ray.len * ray.len);
        return mix(color, fogColor, fogIntensity);
    } else {
        return fogColor;
    }
}


void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
    float screenDepth = 1.0;
    Camera camera;
    Ray ray;
    Intersection intersection;

    lookAt(vec3(orbit * sin(time), 0.5 + 1.0 * sin(time * 0.8), orbit * cos(time)), vec3(0.0), vec3(0.0, 1.0, 0.0), camera);
    // lookAt(vec3(1.5, 0.5, 2.0), vec3(0.0), vec3(0.0, 1.0, 0.0), camera);
    createRay(p, screenDepth, camera, ray);

    vec3 color = vec3(0.0);
    float reflectance = 1.0;

    for (int i = 0; i < 2; i++) {
        intersectObjects(ray, intersection);
        color += reflectance * calcColor(ray, intersection);
        reflectance *= intersection.reflectance;

        if (reflectance < eps) break;

        ray.origin = intersection.pos + intersection.normal * eps * 100.0;
        ray.len = 0.0;
        ray.dir = reflect(ray.dir, intersection.normal);
    }

    gl_FragColor = vec4(color, 1.0);
}