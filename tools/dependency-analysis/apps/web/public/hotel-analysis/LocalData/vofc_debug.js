/**
 * VOFC Debug Script
 * Helps identify issues with the VOFC system
 */

class VOFCDebugger {
    constructor() {
        this.debugResults = {
            systemStatus: {},
            dataStatus: {},
            initializationStatus: {},
            errors: []
        };
    }
    
    /**
     * Run comprehensive debug analysis
     */
    debug() {
        console.log('🔍 Starting VOFC System Debug...');
        
        try {
            this.checkSystemAvailability();
            this.checkDataAvailability();
            this.checkInitialization();
            this.testBasicFunctionality();
            this.generateDebugReport();
            
            console.log('✅ Debug analysis complete!');
            return this.debugResults;
            
        } catch (error) {
            console.error('❌ Debug analysis failed:', error);
            this.debugResults.errors.push(error.message);
            return this.debugResults;
        }
    }
    
    /**
     * Check if VOFC system components are available
     */
    checkSystemAvailability() {
        console.log('🔍 Checking system availability...');
        
        const components = [
            'VOFCManager',
            'VOFCFieldMappings', 
            'VOFCIntegration',
            'VOFCMigration',
            'VOFCEffectivenessTest',
            'vofcMatcher'
        ];
        
        this.debugResults.systemStatus = {};
        
        for (const component of components) {
            const isAvailable = typeof window[component] !== 'undefined';
            this.debugResults.systemStatus[component] = {
                available: isAvailable,
                type: isAvailable ? typeof window[component] : 'undefined'
            };
            
            if (isAvailable) {
                console.log(`  ✅ ${component}: Available (${typeof window[component]})`);
            } else {
                console.log(`  ❌ ${component}: Not available`);
            }
        }
    }
    
    /**
     * Check if VOFC data is available
     */
    checkDataAvailability() {
        console.log('🔍 Checking data availability...');
        
        const dataSources = [
            'VOFC_VULNERABILITIES',
            'VOFC_OPTIONS'
        ];
        
        this.debugResults.dataStatus = {};
        
        for (const dataSource of dataSources) {
            const isAvailable = typeof window[dataSource] !== 'undefined';
            const length = isAvailable ? window[dataSource].length : 0;
            
            this.debugResults.dataStatus[dataSource] = {
                available: isAvailable,
                length: length,
                type: isAvailable ? typeof window[dataSource] : 'undefined'
            };
            
            if (isAvailable) {
                console.log(`  ✅ ${dataSource}: Available (${length} items)`);
            } else {
                console.log(`  ❌ ${dataSource}: Not available`);
            }
        }
    }
    
    /**
     * Check system initialization
     */
    checkInitialization() {
        console.log('🔍 Checking initialization...');
        
        this.debugResults.initializationStatus = {};
        
        // Check if vofcMatcher is initialized
        if (window.vofcMatcher) {
            try {
                const stats = window.vofcMatcher.getStats ? window.vofcMatcher.getStats() : null;
                this.debugResults.initializationStatus.vofcMatcher = {
                    initialized: true,
                    stats: stats,
                    hasAnalyzeMethod: typeof window.vofcMatcher.analyzeAssessment === 'function',
                    hasGetStatsMethod: typeof window.vofcMatcher.getStats === 'function'
                };
                
                console.log(`  ✅ vofcMatcher: Initialized`);
                if (stats) {
                    console.log(`    - Vulnerabilities: ${stats.vulnerabilities}`);
                    console.log(`    - Options: ${stats.options}`);
                    console.log(`    - Field Mappings: ${stats.fieldMappings}`);
                    console.log(`    - Initialized: ${stats.isInitialized}`);
                }
            } catch (error) {
                this.debugResults.initializationStatus.vofcMatcher = {
                    initialized: false,
                    error: error.message
                };
                console.log(`  ❌ vofcMatcher: Initialization error - ${error.message}`);
            }
        } else {
            this.debugResults.initializationStatus.vofcMatcher = {
                initialized: false,
                error: 'vofcMatcher not available'
            };
            console.log(`  ❌ vofcMatcher: Not available`);
        }
    }
    
    /**
     * Test basic functionality
     */
    testBasicFunctionality() {
        console.log('🔍 Testing basic functionality...');
        
        const testData = {
            has_perimeter_barriers: 'No',
            vss_present: 'No',
            secforce_247: 'No'
        };
        
        try {
            if (window.vofcMatcher && typeof window.vofcMatcher.analyzeAssessment === 'function') {
                const result = window.vofcMatcher.analyzeAssessment(testData);
                
                this.debugResults.basicFunctionality = {
                    success: true,
                    result: {
                        vulnerabilities: result.vulnerabilities?.length || 0,
                        options: result.options?.length || 0,
                        overallScore: result.overallScore || 0
                    }
                };
                
                console.log(`  ✅ Basic functionality test passed`);
                console.log(`    - Vulnerabilities found: ${result.vulnerabilities?.length || 0}`);
                console.log(`    - Options generated: ${result.options?.length || 0}`);
                console.log(`    - Overall score: ${result.overallScore || 0}`);
                
            } else {
                this.debugResults.basicFunctionality = {
                    success: false,
                    error: 'analyzeAssessment method not available'
                };
                console.log(`  ❌ Basic functionality test failed: analyzeAssessment method not available`);
            }
        } catch (error) {
            this.debugResults.basicFunctionality = {
                success: false,
                error: error.message
            };
            console.log(`  ❌ Basic functionality test failed: ${error.message}`);
        }
    }
    
    /**
     * Generate debug report
     */
    generateDebugReport() {
        console.log('\n📊 VOFC Debug Report');
        console.log('====================');
        
        // System Status
        console.log('\n🔧 System Components:');
        Object.entries(this.debugResults.systemStatus).forEach(([component, status]) => {
            const icon = status.available ? '✅' : '❌';
            console.log(`  ${icon} ${component}: ${status.available ? 'Available' : 'Missing'}`);
        });
        
        // Data Status
        console.log('\n📊 Data Sources:');
        Object.entries(this.debugResults.dataStatus).forEach(([source, status]) => {
            const icon = status.available ? '✅' : '❌';
            console.log(`  ${icon} ${source}: ${status.available ? `${status.length} items` : 'Missing'}`);
        });
        
        // Initialization Status
        console.log('\n🚀 Initialization:');
        if (this.debugResults.initializationStatus.vofcMatcher) {
            const status = this.debugResults.initializationStatus.vofcMatcher;
            const icon = status.initialized ? '✅' : '❌';
            console.log(`  ${icon} vofcMatcher: ${status.initialized ? 'Initialized' : 'Not initialized'}`);
            if (status.error) {
                console.log(`    Error: ${status.error}`);
            }
        }
        
        // Basic Functionality
        if (this.debugResults.basicFunctionality) {
            console.log('\n🧪 Basic Functionality:');
            const status = this.debugResults.basicFunctionality;
            const icon = status.success ? '✅' : '❌';
            console.log(`  ${icon} Test: ${status.success ? 'Passed' : 'Failed'}`);
            if (status.error) {
                console.log(`    Error: ${status.error}`);
            }
            if (status.result) {
                console.log(`    Vulnerabilities: ${status.result.vulnerabilities}`);
                console.log(`    Options: ${status.result.options}`);
                console.log(`    Score: ${status.result.overallScore}`);
            }
        }
        
        // Errors
        if (this.debugResults.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.debugResults.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }
        
        // Recommendations
        console.log('\n💡 Recommendations:');
        this.generateRecommendations();
    }
    
    /**
     * Generate recommendations based on debug results
     */
    generateRecommendations() {
        const recommendations = [];
        
        // Check if data is missing
        if (!this.debugResults.dataStatus.VOFC_VULNERABILITIES?.available) {
            recommendations.push('Load vofc_vulnerabilities.js script');
        }
        
        if (!this.debugResults.dataStatus.VOFC_OPTIONS?.available) {
            recommendations.push('Load vofc_options.js script');
        }
        
        // Check if core components are missing
        if (!this.debugResults.systemStatus.VOFCManager?.available) {
            recommendations.push('Load vofc_core.js script');
        }
        
        if (!this.debugResults.systemStatus.VOFCIntegration?.available) {
            recommendations.push('Load vofc_integration.js script');
        }
        
        // Check if system is not initialized
        if (!this.debugResults.initializationStatus.vofcMatcher?.initialized) {
            recommendations.push('Initialize VOFC system manually');
        }
        
        // Check if basic functionality failed
        if (!this.debugResults.basicFunctionality?.success) {
            recommendations.push('Fix basic functionality issues');
        }
        
        if (recommendations.length === 0) {
            console.log('  ✅ No issues found - system appears to be working correctly');
        } else {
            recommendations.forEach((rec, index) => {
                console.log(`  ${index + 1}. ${rec}`);
            });
        }
    }
    
    /**
     * Try to fix common issues
     */
    tryFix() {
        console.log('🔧 Attempting to fix common issues...');
        
        try {
            // Try to initialize the system manually
            if (window.VOFC_VULNERABILITIES && window.VOFC_OPTIONS && window.VOFCIntegration) {
                console.log('  🔄 Attempting manual initialization...');
                
                // Create a new integration instance
                const integration = new VOFCIntegration();
                integration.initialize();
                
                // Replace the global instance
                window.vofcMatcher = integration;
                
                console.log('  ✅ Manual initialization completed');
                
                // Test if it works now
                const testData = { has_perimeter_barriers: 'No' };
                const result = window.vofcMatcher.analyzeAssessment(testData);
                
                console.log(`  ✅ Test after fix: ${result.vulnerabilities?.length || 0} vulnerabilities found`);
                
                return true;
            } else {
                console.log('  ❌ Cannot fix - missing required components');
                return false;
            }
        } catch (error) {
            console.log(`  ❌ Fix attempt failed: ${error.message}`);
            return false;
        }
    }
}

// Create global debugger instance
window.vofcDebugger = new VOFCDebugger();

// Add convenience functions
window.debugVOFC = () => window.vofcDebugger.debug();
window.fixVOFC = () => window.vofcDebugger.tryFix();

console.log('🔍 VOFC Debugger loaded!');
console.log('Available commands:');
console.log('  debugVOFC() - Run comprehensive debug analysis');
console.log('  fixVOFC() - Try to fix common issues');
