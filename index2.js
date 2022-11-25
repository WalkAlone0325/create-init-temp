import minimist from 'minimist'
import prompts from 'prompts'
import { blue, green, lightGreen, yellow, reset, red, cyan } from 'kolorist'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const argv = minimist(process.argv.slice(2), { string: ['_'] })

const cwd = process.cwd()

const FRAMEWORKS = [
  {
    name: 'vue',
    color: yellow,
    variants: [
      {
        name: 'vue3',
        display: 'JavaScript',
        color: yellow
      },
      {
        name: 'vue3-ts',
        display: 'TypeScript',
        color: blue
      },
      {
        name: 'vue2.7',
        display: 'JavaScript',
        color: green
      }
    ]
  },
  {
    name: 'library',
    color: yellow,
    variants: [
      {
        name: 'library',
        display: 'JavaScript',
        color: yellow
      },
      {
        name: 'library-ts',
        display: 'TypeScript',
        color: blue
      }
    ]
  }
]

// ['vue', 'vue-ts']
const TEMPLATES = FRAMEWORKS.map(
  (f) => (f.variants && f.variants.map((v) => v.name)) || [f.name]
).reduce((a, b) => a.concat(b), [])

const renameFiles = {
  _gitignore: '.gitignore'
}

const defaultTargetDir = 'template-project'

async function init() {
  const argTargetDir = formatTargetDir(argv._[0])
  // --template / --t xxx => xxx
  const argTemplate = argv.template || argv.t

  // 项目名称
  let targetDir = argTargetDir || defaultTargetDir

  // 如果项目名称写的是 . ，则变为输入命令的目录
  const getProjectName = () =>
    targetDir === '.' ? path.basename(path.resolve()) : targetDir

  let result

  try {
    result = await prompts(
      [
        {
          type: argTargetDir ? null : 'text',
          name: 'projectName',
          // message: reset('Project name:'),
          message: reset('请输入项目名称：'),
          initial: defaultTargetDir,
          // 对输入的项目名称进行规范
          onState: (state) => {
            targetDir = formatTargetDir(state.value) || defaultTargetDir
          }
        },
        // 判断输入，为 . ，判断是否为空路径，是否覆盖，否则直接取输入为项目名称
        {
          type: () =>
            !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : 'confirm',
          name: 'overwrite',
          message: () =>
            (targetDir === '.'
              ? '当前文件夹'
              : // : `Target directory "${targetDir}"`) +
                `目标文件夹 "${targetDir}"`) +
            // ` is not empty. Remove existing files and continue?`
            ` 不是空文件夹。删除现有文件并继续？`
        },
        // 如果选择不覆盖，直接退出界面，取消操作
        {
          type: (_, { overwrite }) => {
            if (overwrite === false) {
              // 不覆盖直接 取消操作
              // throw new Error(red('✖') + 'Operation cancelled')
              throw new Error(red('✖') + '取消操作')
            }
            return null
          },
          name: 'overwriteChecker'
        },
        // 检测包名称
        {
          type: () => (isVaildPackageName(getProjectName()) ? null : 'text'),
          name: 'packageName',
          message: reset('Package name:'),
          inactive: () => toValidPackageName(getProjectName()),
          // 检测是否为有效的包名称
          validate: (dir) =>
            isVaildPackageName(dir) || 'Invalid package.json name'
        },
        // 第一层 选择的框架，如果是选择的框架模版，直接跳过，否则是 select，继续选择 框架模版
        {
          type:
            argTemplate && TEMPLATES.includes(argTemplate) ? null : 'select',
          name: 'framework',
          // 如果选择的模版不在规定发里面，则模版不是有效的，请从下面选择一个框架
          message:
            typeof argTemplate === 'string' && !TEMPLATES.includes(argTemplate)
              ? reset(
                  `"${argTemplate}" isn't a valid template. Please choose from below: `
                )
              : // : reset('Select a framework:'),
                reset('请选择一个框架：'),
          initial: 0,
          choices: FRAMEWORKS.map((framework) => {
            const frameworkColor = framework.color
            return {
              title: frameworkColor(framework.display || framework.name),
              value: framework
            }
          })
        },
        // 第二层
        {
          type: (framework) =>
            framework && framework.variants ? 'select' : null,
          name: 'variant',
          // message: reset('Select a variant'),
          message: reset('请选择具体模版：'),
          choices: (framework) =>
            framework.variants.map((variant) => {
              const variantColor = variant.color
              return {
                title: variantColor(variant.display || variant.name),
                value: variant.name
              }
            })
        }
      ],
      {
        onCancel: () => {
          // throw new Error(red('✖') + ' Operation cancelled')
          throw new Error(red('✖') + ' 取消操作')
        }
      }
    )
  } catch (cancelled) {
    console.log(cancelled.message)
    return
  }

  // console.log('targetDir: ', targetDir)
  // console.log('result: ', result)

  /**
   * 写入
   */
  const { framework, overwrite, packageName, variant } = result

  // 根路径
  const root = path.join(cwd, targetDir)

  // 清空或者创建文件夹
  if (overwrite) {
    // 强制清空文件夹
    emptyDir(root)
  } else if (!fs.existsSync(root)) {
    // recursive 递归的创建文件夹
    fs.mkdirSync(root, { recursive: true })
  }

  // 确定模版
  const template = variant || framework || argTemplate

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
  const pkgManager = pkgInfo ? pkgInfo.name : 'npm'
  const isYarn1 = pkgManager === 'yarn' && pkgInfo?.version.startsWith('1.')

  // 自定义模版

  // 脚手架项目在 root
  // console.log(`\nScaffolding project in ${root}...`)
  console.log(`\n正在写入模版到 ${root} \n请稍等...`)

  // 放置模版文件夹的路径
  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    `template-${template}`
  )

  // 写入
  const write = (file, content) => {
    const targetPath = path.join(root, renameFiles[file] ?? file)
    if (content) {
      fs.writeFileSync(targetPath, content)
    } else {
      copy(path.join(templateDir, file), targetPath)
    }
  }

  // 写入文件
  const files = fs.readdirSync(templateDir)
  for (const file of files.filter((f) => f !== 'package.json')) {
    write(file)
  }

  const pkg = JSON.parse(
    fs.readFileSync(path.join(templateDir, 'package.json'), 'utf-8')
  )

  pkg.name = packageName || getProjectName()
  // 将 package.json 的 name 改为 项目名称
  write('package.json', JSON.stringify(pkg, null, 2))

  // 写入完成后的提示信息
  // console.log(`\nDone. Now run:\n`)
  console.log(`\n写入完成. 请运行如下命令：\n`)
  if (root !== cwd) {
    console.log(lightGreen(`   cd ${path.relative(cwd, root)}`))
  }
  switch (pkgManager) {
    case 'yarn':
      console.log(lightGreen('   yarn'))
      console.log(lightGreen('   yarn dev'))
      break
    default:
      console.log(lightGreen(`   ${pkgManager} install`))
      console.log(lightGreen(`   ${pkgManager} run dev`))
      break
  }
  console.log()
}

function formatTargetDir(targetDir) {
  return targetDir?.trim().replace(/\/+$/g, '')
}

// 复制模版
function copy(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    fs.copyFileSync(src, dest)
  }
}

// 复制文件夹
function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file)
    const destFile = path.resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

// 是否为合规发 packageName
function isVaildPackageName(projectName) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
    projectName
  )
}

// 转换为合规的 packageName
function toValidPackageName(projectName) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-')
}

function isEmpty(path) {
  const files = fs.readdirSync(path)
  return files.length === 0 || (files.length === 1 && files[0] === '.git')
}

// 强制删除成为空文件
function emptyDir(dir) {
  if (!fs.existsSync(dir)) {
    return
  }
  for (const file of fs.readdirSync(dir)) {
    if (file === '.git') {
      continue
    }
    fs.rmSync(path.resolve(dir, file), { recursive: true, force: true })
  }
}

// 获取使用的包管理工具和版本号
function pkgFromUserAgent(userAgent) {
  if (!userAgent) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const pkgSpecArr = pkgSpec.split('/')
  return {
    name: pkgSpecArr[0],
    version: pkgSpecArr[1]
  }
}

init().catch((e) => {
  console.error(e)
})
