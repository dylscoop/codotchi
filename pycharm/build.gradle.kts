plugins {
    id("org.jetbrains.intellij") version "1.17.4"
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
}

group = "com.codotchi"
version = "1.15.1"

repositories {
    mavenCentral()
}

// Separate configuration so the standalone launcher fat-jar can be resolved
// independently and placed first on the JavaExec classpath.
val junitConsole: Configuration by configurations.creating

dependencies {
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    junitConsole("org.junit.platform:junit-platform-console-standalone:1.10.2")
}

intellij {
    version.set("2024.1")
    type.set("IC")   // IntelliJ Community
    plugins.set(listOf())
    updateSinceUntilBuild.set(false)
}

kotlin {
    jvmToolchain(17)
}

tasks {
    buildSearchableOptions {
        enabled = false
    }

    // The org.jetbrains.intellij plugin hooks into ALL tasks of type `Test`
    // during the configuration phase (not just the one named "test") and
    // tries to extract the JBR runtime.  On Windows this fails with a
    // file-lock error on extnet.dll whenever any IDE or Java process already
    // has the JBR open.
    //
    // Solution: run tests via JavaExec (not Test) so the plugin never touches
    // the task.  The JUnit Platform Console Standalone launcher is used to
    // discover and execute JUnit 5 tests from the compiled test classes dir.
    //
    // Usage: gradlew unitTest --no-configuration-cache
    //        (from pycharm/)
    //
    // Do NOT run `gradlew test` — that is the IntelliJ-sandbox path.

    val copySourceForTest by registering(Copy::class) {
        description = "Copies CodotchiPlugin.kt into test resources for source-guard tests."
        from("src/main/kotlin/com/codotchi/CodotchiPlugin.kt")
        into(layout.buildDirectory.dir("resources/test/source"))
    }

    val unitTest by registering(Exec::class) {
        description = "Runs pure JUnit 5 unit tests via java -jar (bypasses IntelliJ plugin hooks)."
        group       = "verification"

        dependsOn("compileTestKotlin", "processResources", copySourceForTest)

        // Resolve the fat-jar and test classpath at configuration time.
        val launcherJar = junitConsole.resolvedConfiguration.resolvedArtifacts
            .first { it.name == "junit-platform-console-standalone" }
            .file
        val testClassesDir   = sourceSets["test"].output.classesDirs.asPath
        val testRuntimeCp    = configurations["testRuntimeClasspath"].asPath
        val testOutputCp     = sourceSets["test"].output.classesDirs.asPath
        // Main resources (webview/*.js, webview/sidebar.html, META-INF/) must be
        // on the test classpath so BrowserPanelHtmlTest can load them.
        val mainResourcesDir = sourceSets["main"].output.resourcesDir!!.absolutePath
        val extraResources   = layout.buildDirectory.dir("resources/test").get().asFile.absolutePath

        val java = "${System.getenv("JAVA_HOME") ?: System.getProperty("java.home")}/bin/java.exe"
        val fullCp = "$testOutputCp;$testRuntimeCp;$mainResourcesDir;$extraResources"

        commandLine(
            java,
            "-jar", launcherJar.absolutePath,
            "--scan-class-path", testClassesDir,
            "--class-path", fullCp,
            "--details", "tree",
            "--fail-if-no-tests"
        )
    }
}
