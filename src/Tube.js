
// 演示如何创建扩展一个czmObject类型的对象

// 0.1 函数准备，借助THREE.js来获取管线的顶点坐标数值
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
    * @default 50
    * @memberof Tube
    */    
    tubularSegments: 50,
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
    * @default 18
    * @memberof Tube
    */      
    radialSegments: 18,
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
            }
        }

        update();
        this.disposers.push(XE.MVVM.watch(() => ({
            positions: [...this.positions],
            tubularSegments: this.tubularSegments,
            radius: this.radius,
            radialSegments: this.radialSegments,
            closed: this.closed,
        }), update));

        const update2 = () => {
            this._customPrimitive.color = this.color;
        };

        update2();
        this.disposers.push(XE.MVVM.watch(() => ({
            color: [...this.color],
        }), update2));

        // 3. 当speed发生变化时，相应地改变customPrimitive对象
        this.disposers.push(XE.MVVM.watch(() => [...this.speed], () => {
            this._customPrimitive.customParams[0] = this.speed[0];
            this._customPrimitive.customParams[1] = this.speed[1];
        }));

        // 4. 当imageUrl发生变化时，相应地改变customPrimitive对象
        this.disposers.push(XE.MVVM.watch(() => this.imageUrl, () => {
            const p = this._customPrimitive;
            if (this.imageUrl) {
                Cesium.Resource.createIfNeeded(this.imageUrl).fetchImage().then(function (image) {
                    p.canvasWidth = image.width;
                    p.canvasHeight = image.height;
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
                float time = czm_frameNumber / 30.0;
                float s = fract(u_customParams.x * time + v_st.s);
                float t = fract(u_customParams.y * time + v_st.t);
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
            autoRegisterEditing: true, // 自动注册编辑，设置为true以后，才可以使用creating、positionEditing、rotationEditing属性。
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

    registerEditing() {
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
