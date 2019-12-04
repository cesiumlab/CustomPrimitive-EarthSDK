
// 演示如何创建扩展一个czmObject类型的对象

// 0.1 纯粹直线管道构建

let scratchMatrix;
let scratchCartesian;

// 创建单段圆柱体
function createSingleCylinder(pos0, pos1, radius, radialSegments, s0, s1, indexStart) {
    let unitCylinderPositions;
    let unitCylinderSts;
    let unitCylinderIndices;

    const r = XE.Obj.CustomPrimitive.Geometry.createCylinder(1.0, 1.0, 1.0, radialSegments);
    unitCylinderPositions = r.positions;
    unitCylinderSts = r.sts;
    unitCylinderIndices = r.indices;

    scratchMatrix = scratchMatrix || new Cesium.Matrix4();
    const modelMatrix = getModelMatrix(pos0, pos1, radius, scratchMatrix);
    
    const positions = [];
    scratchCartesian = scratchCartesian || new Cesium.Cartesian3();
    const ucp = unitCylinderPositions;
    const l = ucp.length / 3 | 0;
    for (let i=0; i<l; ++i) {
        const cartesian = Cesium.Cartesian3.fromElements(ucp[i*3+0], ucp[i*3+1], ucp[i*3+2]);
        Cesium.Matrix4.multiplyByPoint(modelMatrix, cartesian, cartesian);
        positions.push(cartesian.x, cartesian.y, cartesian.z);
    }

    const sts = [];
    for (let i=0; i<l; ++i) {
        const s = s0 + (s1-s0)*unitCylinderSts[i*2+1];
        sts.push(s, unitCylinderSts[i*2+0]);
    }

    const indices = [];
    const il = unitCylinderIndices.length;
    for (let i=0; i<il; ++i) {
        indices.push(unitCylinderIndices[i]+indexStart);
    }

    return {
        positions,
        sts,
        indices,
    };
}

let g_scratchCartesian;
let g_scratchCartesian2;
let g_scratchCartesian3;
let g_scratchCartesian4;
let g_scratchQuat;

// 创建姿态矩阵，和单位圆柱体相乘后可以得到实际的圆柱体
const getModelMatrix = (startPosition, endPosition, radius, result) => {
    g_scratchCartesian = g_scratchCartesian || new Cesium.Cartesian3();
    g_scratchCartesian2 = g_scratchCartesian2 || new Cesium.Cartesian3();
    g_scratchCartesian3 = g_scratchCartesian3 || new Cesium.Cartesian3();
    g_scratchCartesian4 = g_scratchCartesian4 || new Cesium.Cartesian3();
    g_scratchQuat = g_scratchQuat || new Cesium.Quaternion();
    
    const scratchCartesian = g_scratchCartesian;
    const scratchCartesian2 = g_scratchCartesian2;
    const scratchCartesian3 = g_scratchCartesian3;
    const scratchCartesian4 = g_scratchCartesian4;

    const startCartesian = Cesium.Cartesian3.fromElements(startPosition[0], startPosition[1], startPosition[2], scratchCartesian);
    const endCartesian = Cesium.Cartesian3.fromElements(endPosition[0], endPosition[1], endPosition[2], scratchCartesian2);
    let dir = Cesium.Cartesian3.subtract(endCartesian, startCartesian, scratchCartesian3);
    let depth = Cesium.Cartesian3.magnitude(dir);

    if (depth > 0) {
        depth = depth > 0 ? depth : 0.001;

        dir = Cesium.Cartesian3.normalize(dir, dir);
        const angle = Cesium.Cartesian3.angleBetween(dir, Cesium.Cartesian3.UNIT_Z);
        const axis = Cesium.Cartesian3.cross(Cesium.Cartesian3.UNIT_Z, dir, scratchCartesian4);

        const scale = Cesium.Cartesian3.fromElements(radius, radius, depth, scratchCartesian2);
        const quat = Cesium.Quaternion.fromAxisAngle(axis, angle, g_scratchQuat);

        result = result || new Cesium.Matrix4();
        Cesium.Matrix4.fromTranslationQuaternionRotationScale(startCartesian, quat, scale, result);

        return result;
    } else {
        return undefined;
    }
}

// 创建多段圆柱体
// 问题是连接处没有封闭
function createVertexForLines(rawPositions, radius, radialSegments) {
    const segments = rawPositions.length - 1;
    if (segments <= 0) {
        throw new Error('createVertexForLines error!')
    }

    const gpositions = [];
    const rl = rawPositions.length;
    for (let i = 0; i < rl; ++i) {
        gpositions.push([rawPositions[i][0], rawPositions[i][1], rawPositions[i][2]]);
    }

    const [localPositions, centerL] = XE.Obj.CustomPrimitive.Geometry.getLocalPositions(gpositions);
    let center = centerL;

    const lp = localPositions;
    const ll = (lp.length / 3 | 0) - 1;

    let totalDistance = 0;
    const distances = [0];
    for (let i=0; i<ll; ++i) {
        const dx = lp[(i+1)*3+0] - lp[i*3+0];
        const dy = lp[(i+1)*3+1] - lp[i*3+1];
        const dz = lp[(i+1)*3+2] - lp[i*3+2];
        const distance = Math.sqrt(dx*dx+dy*dy+dz*dz) + distances[i];
        distances.push(distance);
        totalDistance += distance;
    }

    const positions = [];
    const sts = [];
    const indices = [];

    let startIndex = 0;
    for (let i=0; i<ll; ++i) {
        const pos0 = [lp[i*3+0], lp[i*3+1], lp[i*3+2]];
        const pos1 = [lp[(i+1)*3+0], lp[(i+1)*3+1], lp[(i+1)*3+2]];
        const s0 = distances[i] / totalDistance;
        const s1 = distances[i+1] / totalDistance;
        const indexStart = startIndex;
        const { positions: lps, sts: lsts, indices: lindices } = createSingleCylinder(pos0, pos1, radius, radialSegments, s0, s1, indexStart);
        startIndex += (lps.length / 3 | 0);

        lps.forEach(e => positions.push(e));
        lsts.forEach(e => sts.push(e));
        lindices.forEach(e => indices.push(e));
    }

    return {
        center,
        positions,
        sts,
        indices,
    };
}

// 0.2 函数准备，借助THREE.js来获取管线的顶点坐标数值
function createVertexForTube(rawPositions, tubularSegments, radius, radialSegments, closed) {
    if (!rawPositions || rawPositions.length <= 1) {
        throw new Error('rawPositions error!')
    }

    let path;
    let center;

    {
        // const positions = [
        //     [2.0315193182543485, 0.6963069713474035, 50.0],
        //     [2.031208054060137, 0.6963058641803516, 50.0],
        //     [2.0312082890850296, 0.6964532955295221, 50.0],              
        // ];

        // const positions = [];
        // const rl = rawPositions.length / 3 | 0;
        // for (let i = 0; i < rl; ++i) {
        //     positions.push([rawPositions[i * 3 + 0], rawPositions[i * 3 + 1], rawPositions[i * 3 + 2]]);
        // }

        const positions = [];
        const rl = rawPositions.length;
        for (let i = 0; i < rl; ++i) {
            positions.push([rawPositions[i][0], rawPositions[i][1], rawPositions[i][2]]);
        }

        const [localPositions, centerL] = XE.Obj.CustomPrimitive.Geometry.getLocalPositions(positions);
        center = centerL;

        const ll = localPositions.length / 3 | 0;
        const vectors = [];
        for (let i = 0; i < ll; ++i) {
            vectors.push(new THREE.Vector3(localPositions[i * 3 + 0], localPositions[i * 3 + 1], localPositions[i * 3 + 2]));
        }
        path = new THREE.CatmullRomCurve3(vectors);
    }

    var geometry = new THREE.TubeGeometry(path, tubularSegments, radius, radialSegments, closed);

    var positions = geometry.faces.flatMap(e => {
        const va = geometry.vertices[e.a];
        const vb = geometry.vertices[e.b];
        const vc = geometry.vertices[e.c];
        return [va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z];
    });

    var sts = geometry.faceVertexUvs[0].flatMap(e => {
        return [e[0].x, e[0].y, e[1].x, e[1].y, e[2].x, e[2].y];
    });

    var normals = geometry.faces.flatMap(e => {
        const va = e.vertexNormals[0];
        const vb = e.vertexNormals[1];
        const vc = e.vertexNormals[2];
        return [va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z];
    });

    var indices = [];
    {
        const fl = geometry.faces.length;
        for (let i = 0; i < fl; ++i) {
            indices.push(i * 3 + 0, i * 3 + 1, i * 3 + 2);
            // 如果画线的话，就再重复一次
            // indices.push(i*3+0, i*3+1, i*3+2);
        }
    }

    return {
        center,
        positions,
        sts,
        normals,
        indices,
    };
}

// 0.2 首先设置默认属性
const defaultOptions = {
    /**
    * 位置数组 [经度, 纬度, 高度, 经度, 纬度, 高度, ...]
    * @type {array}
    * @instance
    * @default [0, 0, 0, 0, 0, 0, ...]
    * @memberof Tube
    */
    positions: [],
    /**
    * 横向分割数
    * @type {number}
    * @instance
    * @default 12
    * @memberof Tube
    */    
    tubularSegments: 12,
    /**
    * 半径大小，单位米
    * @type {number}
    * @instance
    * @default 20.0
    * @memberof Tube
    */
    radius: 20.0,
    /**
    * 径向分割数
    * @type {number}
    * @instance
    * @default 5
    * @memberof Tube
    */      
    radialSegments: 5,
    /**
    * 是否封闭
    * @type {boolean}
    * @instance
    * @default false
    * @memberof Tube
    */    
    closed: false,
    /**
    * 速度数组，第一个元素表示移动速度，第二个元素表示旋转速度
    * @type {array}
    * @instance
    * @default [1, 1]
    * @memberof Tube
    */
    speed: [1, 1],
    /**
    * 纹理在横向和综合的重复次数
    * @type {array}
    * @instance
    * @default [1, 1]
    * @memberof Tube
    */
    repeat: [1, 1],
    /**
    * 图像路径
    * @type {string}
    * @instance
    * @default ''
    * @memberof Tube
    */
    imageUrl: '',
    /**
    * 颜色叠加
    * @type {array}
    * @instance
    * @default [1, 1, 1, 1]
    * @memberof Tube
    */
    color: [1, 1, 1, 1],
    /**
    * 是否为曲线，如果为false，则由一段段的直线构成，直线连接处没有过渡体
    * @type {boolean}
    * @instance
    * @default false
    * @memberof Tube
    */        
    isCurve: true,
};

// 1 基于XE.Core.XbsjCzmObj创建一个自定义的类
class Tube extends XE.Core.XbsjCzmObj {
    constructor(earth, guid) {
        super(earth, guid);

        // 1. Tube内部管理这一个customPrimitive对象
        this._createCustomPrimitive(earth);

        // 2. 当positions发生变化时，相应地改变customPrimitive对象
        // disposer属性是一个数组，用来收集需要在对象销毁时指定的函数
        // XE.MVVM.watch是用来进行监视的函数，第一个参数表明监视的对象，第二个参数表示监视对象发生变化时如何处理，是一个函数
        // XE.MVVM.watch的返回值是一个函数，调用该函数可以取消监控。把该函数放入disposer数组以后，它就会在对象销毁时自动执行。
        const update = () => {
            if (this.positions.length > 1) {
                if (this.isCurve) {
                    const {
                        center,
                        positions,
                        sts,
                        normals,
                        indices,
                    } = createVertexForTube(this.positions, this.tubularSegments, this.radius, this.radialSegments, this.closed);
        
                    this._customPrimitive.position = center;
                    this._customPrimitive.positions = positions;
                    this._customPrimitive.sts = sts;
                    this._customPrimitive.normals = normals;
                    this._customPrimitive.indices = indices;
                } else {
                    const {
                        center,
                        positions,
                        sts,
                        indices,
                    } = createVertexForLines(this.positions, this.radius, this.radialSegments);

                    this._customPrimitive.position = center;
                    this._customPrimitive.positions = positions;
                    this._customPrimitive.sts = sts;
                    this._customPrimitive.normals = undefined;
                    this._customPrimitive.indices = indices;
                }
            }
        }

        update();
        this.disposers.push(XE.MVVM.watch(() => ({
            positions: [...this.positions],
            tubularSegments: this.tubularSegments,
            radius: this.radius,
            radialSegments: this.radialSegments,
            closed: this.closed,
            isCurve: this.isCurve,
        }), update));

        const update2 = () => {
            this._customPrimitive.color = this.color;
        };

        update2();
        this.disposers.push(XE.MVVM.watch(() => ({
            color: [...this.color],
        }), update2));

        // 3. 当speed发生变化时，相应地改变customPrimitive对象
        this.disposers.push(XE.MVVM.watch(() => ({
            speed: [...this.speed],
            repeat: [...this.repeat]
        }), () => {
            this._customPrimitive.customParams[0] = this.speed[0];
            this._customPrimitive.customParams[1] = this.speed[1];
            this._customPrimitive.customParams[2] = this.repeat[0];
            this._customPrimitive.customParams[3] = this.repeat[1];
        }));

        // 4. 当imageUrl发生变化时，相应地改变customPrimitive对象
        this.disposers.push(XE.MVVM.watch(() => this.imageUrl, () => {
            const p = this._customPrimitive;
            if (this.imageUrl) {
                Cesium.Resource.createIfNeeded(this.imageUrl).fetchImage().then(function (image) {
                    p.canvasWidth = image.naturalWidth;
                    p.canvasHeight = image.naturalHeight;
                    p.drawCanvas(ctx => {
                        ctx.clearRect(0, 0, p.canvasWidth, p.canvasHeight);
                        ctx.drawImage(image, 0, 0);
                    });
                });
            } else {
                p.canvasWidth = 1;
                p.canvasHeight = 1;
                p.drawCanvas(ctx => {
                    ctx.clearRect(0, 0, 1, 1);
                    ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
                    ctx.fillRect(0, 0, 1, 1);
                });
            }
        }));

        this._registerEditing();
    }

    _createCustomPrimitive(earth) {
        const renderState = XE.Obj.CustomPrimitive.getRenderState(true, false);

        const fragmentShaderSource = `
            varying vec3 v_positionEC;
            varying vec3 v_normalEC;
            varying vec2 v_st;
            varying vec4 v_color;
            uniform sampler2D u_image;
            uniform vec4 u_color;
            uniform vec4 u_customParams;
            void main()
            {
                float time = czm_frameNumber / 60.0;
                float s = fract(u_customParams.z*(u_customParams.x * time + v_st.s));
                float t = fract(u_customParams.w*(u_customParams.y * time + v_st.t));
                vec4 imageColor = texture2D(u_image, vec2(s, t));
                gl_FragColor = imageColor * u_color;
            }
        `;

        const config = {
            // position: center,
            // positions,
            // sts,
            // indices,
            // color: [0.5, 0.8, 1.0, 1.0],
            customParams: [1.0, 1.0, 1.0, 1.0],
            renderState,
            // primitiveType: WebGL2RenderingContext.LINES,
            fragmentShaderSource,
            pass: Cesium.Pass.TRANSLUCENT,
            // evalString,
        };

        this._customPrimitive = new XE.Obj.CustomPrimitive(earth);
        this._customPrimitive.xbsjFromJSON(config);

        // disposers用来再对象销毁时调用
        this.disposers.push(() => {
            this._customPrimitive = this._customPrimitive && this._customPrimitive.destroy();
        });
    }

    flyTo() {
        this._customPrimitive.flyTo();
    }

    _registerEditing() {
        // 5 编辑
        this.disposers.push(XE.Earth.Interaction.InteractionProperty.registerPolylineCreating(this._earth, this, {
            polylineCreatingProperty: 'creating',
        }));
    
        this.disposers.push(XE.Earth.Interaction.InteractionProperty.registerPolylineEditing(this._earth, this, {
            polylineEditingProperty: 'editing',
        }));   
    }  
}

// 2 设置默认属性
Tube.defaultOptions = defaultOptions;

XE.Core.XbsjCzmObj.registerType(Tube, 'CustomPrimitiveExt_Tube');

export default Tube;
