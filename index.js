import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import minimist from 'minimist'
import prompts from 'prompts'
import { yellow, blue, green, reset, red, lightGreen } from 'kolorist'
import { title } from './utils/banner.js'

const argv = minimist(process.argv.slice(2), { string: '_' })
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
    color: blue,
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

const TEMPLATES = FRAMEWORKS.map(
  (f) => (f.variants && f.variants.map((v) => v.name)) || [f.name]
).reduce((a, b) => a.concat(b), [])

const renameFiles = {
  _gitignore: '.gitignore',
  '_eslintrc.cjs': '.eslintrc.cjs'
}

async function init() {
  console.log(`\n${title}\n`)

  let targetDir = formatTargetDir(argv._[0])
  let template = argv.template || argv.t

  const defaultTargetDir = 'template-project'
  const getProjectName = () =>
    targetDir === '.' ? path.basename(path.resolve()) : targetDir

  let result = {}

  try {
    result = await prompts(
      [
        {
          type: targetDir ? null : 'text',
          name: 'projectName',
          message: reset('请输入项目名称'),
          initial: defaultTargetDir,
          onState: (state) => {
            targetDir = formatTargetDir(state.value) || defaultTargetDir
          }
        },
        {
          type: () =>
            !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : 'confirm',
          name: 'overwrite',
          message: () =>
            (targetDir === '.' ? '当前文件夹' : `目标文件夹 "${targetDir}"`) +
            ` 不是空的。删除现有文件并继续?`
        },
        {
          type: (_, { overwrite } = {}) => {
            if (overwrite === false) {
              throw new Error(red('✖') + ' 取消操作')
            }
            return null
          },
          name: 'overwriteChecker'
        },
        {
          type: () => (isValidPackageName(getProjectName()) ? null : 'text'),
          name: 'packageName',
          message: reset('请输入项目名称'),
          initial: () => toValidPackageName(getProjectName()),
          validate: (dir) =>
            isValidPackageName(dir) || 'Invalid package.json name'
        },
        {
          type: template && TEMPLATES.includes(template) ? null : 'select',
          name: 'framework',
          message:
            typeof template === 'string' && !TEMPLATES.includes(template)
              ? reset(`"${template}" 不是有效的类型。请从以下选项中选择:`)
              : reset('请选择一个类型'),
          initial: 0,
          choices: FRAMEWORKS.map((framework) => {
            const frameworkColor = framework.color
            return {
              title: frameworkColor(framework.name),
              value: framework
            }
          })
        },
        {
          type: (framework) =>
            framework && framework.variants ? 'select' : null,
          name: 'variant',
          message: reset('请选择一个模版'),
          choices: (framework) =>
            framework.variants.map((variant) => {
              const variantColor = variant.color
              return {
                title: variantColor(variant.name),
                value: variant.name
              }
            })
        }
      ],
      {
        onCancel: () => {
          throw new Error(red('✖') + ' 取消操作')
        }
      }
    )
  } catch (cancelled) {
    console.log(cancelled.message)
    return
  }

  const { framework, overwrite, packageName, variant } = result

  const root = path.join(cwd, targetDir)

  if (overwrite) {
    emptyDir(root)
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true })
  }

  template = variant || framework?.name || template

  console.log(`\n正在生成项目模版 ${root} \n请稍等...`)

  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    `template-${template}`
  )

  const write = (file, content) => {
    const targetPath = renameFiles[file]
      ? path.join(root, renameFiles[file])
      : path.join(root, file)
    if (content) {
      fs.writeFileSync(targetPath, content)
    } else {
      copy(path.join(templateDir, file), targetPath)
    }
  }

  const files = fs.readdirSync(templateDir)
  for (const file of files.filter((f) => f !== 'package.json')) {
    write(file)
  }

  const isDeno = template.startsWith('deno-')
  if (isDeno) {
    console.log(`\n完成。可以运行:\n`)
    if (root !== cwd) {
      console.log(lightGreen(`  cd ${path.relative(cwd, root)}`))
    }
    console.log(lightGreen(`  deno task dev`))
    console.log()
  } else {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(templateDir, `package.json`), 'utf-8')
    )

    pkg.name = packageName || getProjectName()

    write('package.json', JSON.stringify(pkg, null, 2))

    const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)

    const pkgManager = pkgInfo ? pkgInfo.name : 'npm'

    console.log(`\n完成。可以运行:\n`)
    if (root !== cwd) {
      console.log(lightGreen(`  cd ${path.relative(cwd, root)}`))
    }
    switch (pkgManager) {
      case 'yarn':
        console.log(lightGreen('  yarn'))
        console.log(lightGreen('  yarn dev'))
        break
      default:
        console.log(lightGreen(`  ${pkgManager} install`))
        console.log(lightGreen(`  ${pkgManager} run dev`))
        break
    }
    console.log()
  }
}

function formatTargetDir(targetDir) {
  return targetDir?.trim().replace(/\/+$/g, '')
}

function copy(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    fs.copyFileSync(src, dest)
  }
}
function isValidPackageName(projectName) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
    projectName
  )
}

function toValidPackageName(projectName) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-')
}

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file)
    const destFile = path.resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

function isEmpty(path) {
  const files = fs.readdirSync(path)
  return files.length === 0 || (files.length === 1 && files[0] === '.git')
}

function emptyDir(dir) {
  if (!fs.existsSync(dir)) {
    return
  }
  for (const file of fs.readdirSync(dir)) {
    fs.rmSync(path.resolve(dir, file), { recursive: true, force: true })
  }
}

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
